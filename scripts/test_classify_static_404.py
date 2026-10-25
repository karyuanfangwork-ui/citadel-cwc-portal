import unittest
from classify_static_404 import classify

class Static404ClassificationTests(unittest.TestCase):
    def test_sanitizes_identity_and_preserves_classification(self):
        rows = [
            '198.51.100.3 - - [24/Oct/2026:12:00:00 +0000] "GET /assets/index-secret123.js?token=secret HTTP/1.1" 404 100 "https://cwc.citadelgroup.com.my/page" "Mozilla/5.0" "-"\n',
            '198.51.100.4 - - [24/Oct/2026:12:00:01 +0000] "GET /wp-login.php HTTP/1.1" 404 100 "-" "scannerbot" "-"\n',
            'malformed 404 log\n',
        ]
        result = classify(rows)
        self.assertEqual((result['count'], result['unparsed_404_candidates']), (2, 1))
        self.assertEqual(result['events'][0]['path_class'], 'vite_asset')
        self.assertEqual(result['events'][0]['referrer_class'], 'same_site')
        self.assertEqual(result['events'][1]['agent_class'], 'bot')
        self.assertNotIn('secret', str(result))
        self.assertNotIn('198.51.100', str(result))

if __name__ == '__main__':
    unittest.main()
