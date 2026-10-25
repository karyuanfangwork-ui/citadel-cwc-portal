#!/usr/bin/env python3
"""Read-only host capacity probe. Run on the Docker host, not in a container.

Exit codes: 0 healthy, 2 threshold breach, 3 probe/configuration failure.
Wire nonzero exits to an owned external paging channel; this script sends nothing.
"""
import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys

GIB = 1024 ** 3
MIB = 1024 ** 2


def command(*args):
    result = subprocess.run(args, text=True, capture_output=True, timeout=30, check=True)
    return result.stdout


def memory_linux():
    values = {}
    with open('/proc/meminfo', encoding='ascii') as source:
        for line in source:
            key, _, remainder = line.partition(':')
            if key in ('MemAvailable', 'SwapTotal', 'SwapFree'):
                values[key] = int(remainder.split()[0]) * 1024
    if set(values) != {'MemAvailable', 'SwapTotal', 'SwapFree'}:
        raise ValueError('incomplete /proc/meminfo')
    return values


def measure(path):
    disk = shutil.disk_usage(path)
    stat = os.statvfs(path)
    # bavail and favail are unprivileged headroom, not root-reserved blocks.
    return {'total_bytes': disk.total, 'available_bytes': stat.f_bavail * stat.f_frsize,
            'inodes_total': stat.f_files, 'inodes_available': stat.f_favail}


def evaluate(disk, memory, args):
    issues = []
    unknown = []
    if disk['total_bytes'] <= 0 or disk['available_bytes'] < 0:
        unknown.append('disk measurement invalid')
    else:
        if disk['available_bytes'] < args.min_free_gib * GIB:
            issues.append('disk available below threshold')
        if 100 * disk['available_bytes'] / disk['total_bytes'] < args.min_free_percent:
            issues.append('disk free percent below threshold')
    if disk['inodes_total'] <= 0 or disk['inodes_available'] < 0:
        unknown.append('inode measurement unavailable')
    elif 100 * disk['inodes_available'] / disk['inodes_total'] < args.min_inodes_percent:
        issues.append('inode free percent below threshold')
    if memory is None:
        unknown.append('available memory/swap measurement unavailable (Linux host required)')
    else:
        if memory['MemAvailable'] < args.min_memory_mib * MIB:
            issues.append('available memory below threshold')
        swap_total = memory['SwapTotal']
        if swap_total < 0 or memory['SwapFree'] < 0 or memory['SwapFree'] > swap_total:
            unknown.append('swap measurement invalid')
        elif swap_total and 100 * (swap_total - memory['SwapFree']) / swap_total > args.max_swap_used_percent:
            issues.append('swap usage above threshold (not proof of OOM)')
    return ('UNKNOWN' if unknown else 'ALERT' if issues else 'OK'), issues, unknown


def inventory(backup_dir):
    result = {}
    probes = {
        'filesystem_human': ('df', '-h', '/'),
        'filesystem_inodes': ('df', '-i', '/'),
        'docker_disk_usage': ('docker', 'system', 'df', '-v'),
        'docker_volumes': ('docker', 'volume', 'ls', '--format', '{{.Name}}'),
        'docker_container_log_paths': ('docker', 'ps', '-aq'),
    }
    for name, args in probes.items():
        try:
            result[name] = command(*args).strip()
        except (OSError, subprocess.SubprocessError) as exc:
            result[name] = 'UNAVAILABLE: ' + type(exc).__name__
    # Never inspect/print container environment: it can contain credentials.
    ids = result['docker_container_log_paths'].splitlines()
    logs = []
    if ids and not result['docker_container_log_paths'].startswith('UNAVAILABLE'):
        try:
            paths = command('docker', 'inspect', '--format', '{{.LogPath}}', *ids).splitlines()
            for path in paths:
                if path:
                    try:
                        logs.append({'bytes': os.stat(path).st_size})
                    except OSError:
                        logs.append({'bytes': None, 'note': 'host log path unreadable'})
        except (OSError, subprocess.SubprocessError):
            logs.append({'bytes': None, 'note': 'docker log inspect unavailable'})
    result['container_json_log_sizes'] = logs
    del result['docker_container_log_paths']
    # Volume mountpoints are measured only when already readable to this user.
    # No privileged helpers, container exec, or Docker mutations.
    volumes = []
    names = result['docker_volumes'].splitlines()
    if names and not result['docker_volumes'].startswith('UNAVAILABLE'):
        try:
            mounts = command('docker', 'volume', 'inspect', '--format', '{{.Mountpoint}}', *names).splitlines()
            for name, mount in zip(names, mounts):
                entry = {'name': name, 'bytes': None}
                if os.access(mount, os.R_OK | os.X_OK):
                    try:
                        entry['bytes'] = int(command('du', '-sk', mount).split()[0]) * 1024
                    except (ValueError, IndexError, OSError, subprocess.SubprocessError):
                        pass
                volumes.append(entry)
        except (OSError, subprocess.SubprocessError):
            result['volume_error'] = 'mountpoint inspection unavailable'
    result['volume_sizes'] = volumes
    try:
        backups = []
        with os.scandir(backup_dir) as entries:
            for item in entries:
                if item.is_file(follow_symlinks=False):
                    stat = item.stat(follow_symlinks=False)
                    backups.append({'name': item.name, 'bytes': stat.st_size,
                                    'modified_utc': dt.datetime.fromtimestamp(
                                        stat.st_mtime, dt.timezone.utc).isoformat()})
        result['backups'] = sorted(backups, key=lambda item: item['modified_utc'])
    except OSError:
        result['backups'] = 'unavailable (directory absent or unreadable)'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--path', default='/', help='filesystem to measure (default: host root)')
    parser.add_argument('--inventory', action='store_true', help='include read-only Docker inventory')
    parser.add_argument('--backup-dir', default='./backups', help='local backup directory to inventory')
    parser.add_argument('--min-free-gib', type=float, default=8)
    parser.add_argument('--min-free-percent', type=float, default=15)
    parser.add_argument('--min-inodes-percent', type=float, default=10)
    parser.add_argument('--min-memory-mib', type=float, default=512)
    parser.add_argument('--max-swap-used-percent', type=float, default=80)
    args = parser.parse_args()
    if any(not (0 <= value <= 100) for value in
           (args.min_free_percent, args.min_inodes_percent, args.max_swap_used_percent)) or any(
           value < 0 for value in (args.min_free_gib, args.min_memory_mib)):
        parser.error('thresholds must be nonnegative; percent thresholds at most 100')
    report = {'timestamp_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'path': args.path}
    try:
        report['disk'] = measure(args.path)
    except (OSError, ValueError) as exc:
        report['status'] = 'UNKNOWN'
        report['unknown'] = ['filesystem measurement failed: ' + type(exc).__name__]
        print(json.dumps(report, sort_keys=True))
        return 3
    try:
        report['memory'] = memory_linux()
    except (OSError, ValueError):
        report['memory'] = None
    report['status'], report['issues'], report['unknown'] = evaluate(report['disk'], report['memory'], args)
    if args.inventory:
        report['inventory'] = inventory(args.backup_dir)
    print(json.dumps(report, sort_keys=True))
    return {'OK': 0, 'ALERT': 2, 'UNKNOWN': 3}[report['status']]


if __name__ == '__main__':
    sys.exit(main())
