#!/usr/bin/env python3
"""Read-only verified HTTPS serving-certificate expiry probe; no renewal attempt."""
import argparse
from datetime import datetime, timedelta, timezone
import socket
import ssl


def validate_thresholds(warning_days, critical_days):
    if critical_days < 0 or warning_days <= critical_days:
        raise ValueError('require warning-days > critical-days >= 0')


def classify(expiry, now, warning_days, critical_days):
    validate_thresholds(warning_days, critical_days)
    remaining = expiry - now
    if remaining <= timedelta(days=critical_days):
        return 'CRITICAL'
    if remaining <= timedelta(days=warning_days):
        return 'WARNING'
    return 'OK'


def probe(host, port, timeout):
    context = ssl.create_default_context()  # CA + hostname validation; SNI below
    with socket.create_connection((host, port), timeout=timeout) as sock:
        with context.wrap_socket(sock, server_hostname=host) as tls:
            cert = tls.getpeercert()
    expiry = cert.get('notAfter') if cert else None
    if not isinstance(expiry, str):
        raise ValueError('verified peer certificate omitted notAfter')
    return datetime.strptime(expiry, '%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('host', help='explicit approved hostname (no implicit production target)')
    parser.add_argument('--port', type=int, default=443)
    parser.add_argument('--timeout', type=float, default=5)
    parser.add_argument('--warning-days', type=int, default=30)
    parser.add_argument('--critical-days', type=int, default=14)
    args = parser.parse_args()
    try:
        validate_thresholds(args.warning_days, args.critical_days)
        if not 1 <= args.port <= 65535 or args.timeout <= 0:
            raise ValueError('invalid port or timeout')
        expiry = probe(args.host, args.port, args.timeout)
        state = classify(expiry, datetime.now(timezone.utc), args.warning_days, args.critical_days)
        print(f'{state}: {args.host} serving certificate expires {expiry.isoformat()}')
        return {'OK': 0, 'WARNING': 1, 'CRITICAL': 2}[state]
    except (OSError, ssl.SSLError, ValueError) as exc:
        print(f'UNKNOWN: certificate check failed: {type(exc).__name__}: {exc}')
        return 3


if __name__ == '__main__':
    raise SystemExit(main())
