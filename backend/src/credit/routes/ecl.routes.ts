import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { eclController } from '../controllers/ecl.controller';

const router = Router();
router.use(authenticate);

router.get('/:applicationId/ecl-snapshots', requirePermission('credit:read'), eclController.listSnapshots);
router.post('/:applicationId/ecl-snapshots', requirePermission('credit:write'), eclController.createSnapshot);
router.patch('/:applicationId/ecl-snapshots/:snapshotId', requirePermission('credit:write'), eclController.updateSnapshot);
router.delete('/:applicationId/ecl-snapshots/:snapshotId', requirePermission('credit:write'), eclController.deleteSnapshot);

router.get('/:applicationId/ecl-forecasts', requirePermission('credit:read'), eclController.listForecasts);
router.put('/:applicationId/ecl-forecasts/:year', requirePermission('credit:write'), eclController.upsertForecast);

export default router;
