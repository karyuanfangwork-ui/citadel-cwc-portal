#!/usr/bin/env python3
"""Offline Vite dist reference check. Does not inspect deployed assets or logs."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

CSS_URL = re.compile(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', re.I)


class AssetReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.refs.append(attrs['src'])
        if tag == 'link' and attrs.get('href') and set((attrs.get('rel') or '').lower().split()) & {'stylesheet', 'icon', 'modulepreload', 'preload'}:
            self.refs.append(attrs['href'])


def local_path(ref, base):
    parts = urlsplit(ref)
    if parts.scheme or parts.netloc or ref.startswith('//') or not parts.path:
        return None
    path = unquote(parts.path)
    return Path(path.lstrip('/')) if path.startswith('/') else base / path


def check_dist(dist):
    dist = Path(dist)
    index = dist / 'index.html'
    if not index.is_file():
        return ['index.html']
    parser = AssetReferences()
    parser.feed(index.read_text(encoding='utf-8'))
    missing = set()
    visited = set()

    def inspect(ref, base):
        path = local_path(ref, base)
        if path is None:
            return
        target = (dist / path).resolve()
        if not target.is_relative_to(dist.resolve()) or not target.is_file():
            missing.add(ref)
            return
        if target.suffix == '.css' and target not in visited:
            visited.add(target)
            css = target.read_text(encoding='utf-8')
            for css_ref in CSS_URL.findall(css):
                inspect(css_ref.strip(), target.relative_to(dist.resolve()).parent)

    for ref in parser.refs:
        inspect(ref, Path('.'))
    return sorted(missing)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dist', type=Path, help='local frontend/dist directory')
    args = parser.parse_args()
    missing = check_dist(args.dist)
    if missing:
        print(f'FAIL: {len(missing)} unresolved local build references:')
        for ref in missing:
            print(ref)
        return 1
    print('OK: local index references and referenced CSS url() assets exist')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
