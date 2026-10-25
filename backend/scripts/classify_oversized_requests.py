#!/usr/bin/env python3
"""Read Nginx access log from stdin; emit redacted 413 inventory as JSON.

No URL, query, IP, user agent, referrer, body, or account ID is printed.
Nginx logs cannot prove identity, upload intent, or whether a 413 came from proxy
versus upstream; correlate timestamps with restricted app logs and owner evidence.
"""
import json
import re
import sys

LOG = re.compile(
    r'^\S+ - \S+ \[(?P<time>[^\]]+)\] "(?P<method>[A-Z]+) (?P<target>\S+) HTTP/[0-9.]+" '
    r'(?P<status>\d{3}) \S+ "[^"\r\n]*" "[^"\r\n]*" "[^"\r\n]*"$'
)


def category(method, target):
    # Exact path only, not a prefix or regex matching attacker-controlled text.
    path = target.split('?', 1)[0]
    if method == 'POST' and path == '/api/v1/crm/import/upload':
        return 'crm_import_upload'
    if method == 'POST' and re.fullmatch(r'/api/v1/crm/leads/[^/]+/documents', path):
        return 'crm_lead_documents'
    if method == 'POST' and path == '/api/v1/users/import':
        return 'staff_import'
    if method == 'POST' and path == '/api/v1/assets/import/parse':
        return 'asset_import'
    if path.startswith('/api/'):
        return 'other_api'
    return 'non_api'


def classify(lines):
    events = []
    unparsed = 0
    unparsed_413 = 0
    for line in lines:
        # A malformed line must never be silently dropped from a completeness claim.
        match = LOG.match(line.rstrip('\n'))
        if not match:
            unparsed += 1
            if re.search(r'\s413\s', line):
                unparsed_413 += 1
            continue
        row = match.groupdict()
        if row['status'] != '413':
            continue
        events.append({
            'timestamp': row['time'],
            'method': row['method'],
            'route_category': category(row['method'], row['target']),
            'status': 413,
            'journey': 'unverified',
        })
    return {'count': len(events), 'unparsed_lines': unparsed,
            'unparsed_413_candidates': unparsed_413, 'events': events,
            'caveat': 'Nginx access logs alone cannot confirm caller authorization, file size, or rejection layer.'}


if __name__ == '__main__':
    json.dump(classify(sys.stdin), sys.stdout, indent=2)
    sys.stdout.write('\n')
