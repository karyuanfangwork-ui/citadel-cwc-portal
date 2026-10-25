"""Offline, synthetic tests; never contact a deployed service."""
import importlib.util
import pathlib
import tempfile
import unittest
import io
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from contextlib import redirect_stdout

HERE = pathlib.Path(__file__).parent
SCRATCH = pathlib.Path.home() / '.hermes/cache/scratch'


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StaticAssetsTests(unittest.TestCase):
    def setUp(self):
        self.check = load('static_assets', 'check-static-assets.py')

    def test_local_vite_assets_present_and_missing(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as tmp:
            dist = pathlib.Path(tmp)
            (dist / 'assets').mkdir()
            (dist / 'index.html').write_text('''<script type="module" src="/assets/app-123.js"></script>
              <link rel="stylesheet" href="/assets/app-456.css">
              <link rel="icon" href="/favicon.svg">''')
            (dist / 'assets/app-123.js').write_text('')
            (dist / 'assets/app-456.css').write_text('body{background:url("/assets/bg-789.png")}')
            (dist / 'favicon.svg').write_text('')
            (dist / 'assets/bg-789.png').write_bytes(b'png')
            self.assertEqual(self.check.check_dist(dist), [])
            (dist / 'assets/bg-789.png').unlink()
            self.assertEqual(self.check.check_dist(dist), ['/assets/bg-789.png'])

    def test_rejects_escaping_references_and_ignores_external(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as tmp:
            dist = pathlib.Path(tmp)
            (dist / 'index.html').write_text('''<script src="/../../private.js"></script>
              <script src="https://cdn.example/app.js"></script>''')
            self.assertEqual(self.check.check_dist(dist), ['/../../private.js'])

    def test_missing_index_is_failure(self):
        with tempfile.TemporaryDirectory(dir=SCRATCH) as tmp:
            self.assertEqual(self.check.check_dist(pathlib.Path(tmp)), ['index.html'])


class TlsExpiryTests(unittest.TestCase):
    def setUp(self):
        self.check = load('tls_expiry', 'check-tls-expiry.py')

    def test_warning_and_critical_thresholds(self):
        now = datetime(2026, 10, 24, tzinfo=timezone.utc)
        self.assertEqual(self.check.classify(now + timedelta(days=35), now, 30, 14), 'OK')
        self.assertEqual(self.check.classify(now + timedelta(days=30), now, 30, 14), 'WARNING')
        self.assertEqual(self.check.classify(now + timedelta(days=14), now, 30, 14), 'CRITICAL')
        self.assertEqual(self.check.classify(now - timedelta(seconds=1), now, 30, 14), 'CRITICAL')

    def test_invalid_thresholds_fail_closed(self):
        with self.assertRaises(ValueError):
            self.check.validate_thresholds(14, 30)
        with self.assertRaises(ValueError):
            self.check.validate_thresholds(0, -1)

    def test_probe_verifies_host_and_sni(self):
        class Socket:
            def __enter__(self): return self
            def __exit__(self, *args): pass
        class TlsSocket(Socket):
            def getpeercert(self): return {'notAfter': 'Dec  2 05:34:47 2026 GMT'}
        class Context:
            def wrap_socket(self, sock, server_hostname):
                assert server_hostname == 'example.test'
                return TlsSocket()
        with patch.object(self.check.socket, 'create_connection', return_value=Socket()) as conn, patch.object(self.check.ssl, 'create_default_context', return_value=Context()):
            expiry = self.check.probe('example.test', 443, 5)
        self.assertEqual(expiry, datetime(2026, 12, 2, 5, 34, 47, tzinfo=timezone.utc))
        conn.assert_called_once_with(('example.test', 443), timeout=5)

    def test_cli_warning_is_nonzero_and_probe_failure_is_unknown(self):
        with patch('sys.argv', ['check-tls-expiry.py', 'example.test']), patch.object(self.check, 'probe', return_value=datetime.now(timezone.utc) + timedelta(days=20)), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(self.check.main(), 1)
            self.assertIn('WARNING:', output.getvalue())
        with patch('sys.argv', ['check-tls-expiry.py', 'example.test']), patch.object(self.check, 'probe', side_effect=OSError('connection refused')), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(self.check.main(), 3)
            self.assertIn('UNKNOWN:', output.getvalue())


if __name__ == '__main__':
    unittest.main()
