#!/usr/bin/env python3
"""Classify frontend Nginx 404s from stdin without emitting raw paths or visitors."""
import json
import re
import sys
from urllib.parse import urlsplit

ACCESS = re.compile(
    r'^\S+ - \S+ \[(?P<time>[^\]]+)\] "(?P<method>[A-Z]+) (?P<target>\S+) HTTP/[0-9.]+" '
    r'(?P<status>\d{3}) \S+ "(?P<referrer>[^"\r\n]*)" "(?P<agent>[^"\r\n]*)"(?: "[^"\r\n]*")?$'
)
EXT = re.compile(r'\.([a-z0-9]{1,8})$', re.I)

def classify(lines):
    events = []
    unparsed = 0
    unparsed_404 = 0
    for line in lines:
        match = ACCESS.match(line.rstrip('\n'))
        if not match:
            unparsed += 1
            if re.search(r'\s404\s', line):
                unparsed_404 += 1
            continue
        row = match.groupdict()
        if row['status'] != '404':
            continue
        path = urlsplit(row['target']).path
        ext = EXT.search(path)
        agent = row['agent'].lower()
        referrer = row['referrer']
        events.append({
            'timestamp': row['time'], 'method': row['method'], 'status': 404,
            'path_class': 'vite_asset' if path.startswith('/assets/') else 'other_static',
            'extension': ext.group(1).lower() if ext else 'none',
            'referrer_class': 'none' if referrer == '-' else 'same_site' if urlsplit(referrer).hostname == 'cwc.citadelgroup.com.my' else 'other',
            'agent_class': 'bot' if re.search(r'bot|crawler|spider|scan', agent) else 'browser' if re.search(r'mozilla|chrome|safari|firefox', agent) else 'other',
        })
    return {'count': len(events), 'unparsed_lines': unparsed,
            'unparsed_404_candidates': unparsed_404, 'events': events}

if __name__ == '__main__':
    json.dump(classify(sys.stdin), sys.stdout, indent=2)
    sys.stdout.write('\n')
