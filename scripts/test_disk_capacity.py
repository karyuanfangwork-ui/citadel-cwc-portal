"""Run: python3 -m unittest discover -s scripts -p 'test_disk_capacity.py'."""
import argparse
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('capacity', Path(__file__).with_name('disk-capacity.py'))
assert spec is not None and spec.loader is not None
capacity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capacity)


class CapacityTests(unittest.TestCase):
    def setUp(self):
        self.args = argparse.Namespace(min_free_gib=8, min_free_percent=15,
                                       min_inodes_percent=10, min_memory_mib=512,
                                       max_swap_used_percent=80)
        self.disk = dict(total_bytes=48 * capacity.GIB, available_bytes=12 * capacity.GIB,
                         inodes_total=1000, inodes_available=500)
        self.memory = dict(MemAvailable=1024 * capacity.MIB,
                           SwapTotal=1024 * capacity.MIB, SwapFree=512 * capacity.MIB)

    def test_healthy(self):
        self.assertEqual(capacity.evaluate(self.disk, self.memory, self.args)[0], 'OK')

    def test_disk_absolute_and_percent_thresholds(self):
        self.disk['available_bytes'] = 6 * capacity.GIB
        status, issues, _ = capacity.evaluate(self.disk, self.memory, self.args)
        self.assertEqual(status, 'ALERT')
        self.assertEqual(len(issues), 2)

    def test_inode_threshold(self):
        self.disk['inodes_available'] = 9
        self.assertIn('inode free percent below threshold',
                      capacity.evaluate(self.disk, self.memory, self.args)[1])

    def test_memory_threshold(self):
        self.memory['MemAvailable'] = 500 * capacity.MIB
        self.assertIn('available memory below threshold',
                      capacity.evaluate(self.disk, self.memory, self.args)[1])

    def test_swap_threshold_does_not_claim_oom(self):
        self.memory['SwapFree'] = 100 * capacity.MIB
        self.assertEqual(capacity.evaluate(self.disk, self.memory, self.args)[0], 'ALERT')
        self.assertIn('not proof of OOM', capacity.evaluate(self.disk, self.memory, self.args)[1][0])

    def test_no_swap_is_valid(self):
        self.memory.update(SwapTotal=0, SwapFree=0)
        self.assertEqual(capacity.evaluate(self.disk, self.memory, self.args)[0], 'OK')

    def test_missing_data_fails_closed(self):
        self.assertEqual(capacity.evaluate(self.disk, None, self.args)[0], 'UNKNOWN')
        self.disk['inodes_total'] = 0
        self.assertEqual(capacity.evaluate(self.disk, self.memory, self.args)[0], 'UNKNOWN')


if __name__ == '__main__':
    unittest.main()
