import io
import unittest
from classify_oversized_requests import classify, category


class ClassificationTests(unittest.TestCase):
    def test_redacts_identity_query_and_user_agent_and_does_not_infer_legitimacy(self):
        sample = ('203.0.113.1 - jane [24/Oct/2026:10:00:00 +0000] '
                  '"POST /api/v1/crm/import/upload?token=secret HTTP/1.1" 413 123 '
                  '"https://example.invalid/private" "SecretAgent" "10.0.0.1"\n')
        output = classify(io.StringIO(sample))
        self.assertEqual(output['count'], 1)
        self.assertEqual(output['events'][0], {
            'timestamp': '24/Oct/2026:10:00:00 +0000',
            'method': 'POST', 'route_category': 'crm_import_upload',
            'status': 413, 'journey': 'unverified',
        })
        self.assertNotIn('secret', str(output).lower())
        self.assertNotIn('203.0.113.1', str(output))
        self.assertNotIn('SecretAgent', str(output))

    def test_counts_unparsed_lines_and_only_reports_413(self):
        lines = ['bad line\n', 'malformed 413 line\n',
                 '1.2.3.4 - - [24/Oct/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 12 "-" "-" "-"\n',
                 '1.2.3.4 - - [24/Oct/2026:10:00:00 +0000] "POST /api/v1/users/import HTTP/1.1" 413 12 "-" "-" "-"\n']
        self.assertEqual(classify(lines)['unparsed_lines'], 2)
        self.assertEqual(classify(lines)['unparsed_413_candidates'], 1)
        self.assertEqual(classify(lines)['events'][0]['route_category'], 'staff_import')
        self.assertEqual(classify(lines)['count'], 1)

    def test_no_prefix_matching_for_import_route(self):
        self.assertEqual(category('POST', '/api/v1/crm/import/upload-extra?x=1'), 'other_api')
        self.assertEqual(category('GET', '/api/v1/crm/import/upload'), 'other_api')


if __name__ == '__main__':
    unittest.main()
