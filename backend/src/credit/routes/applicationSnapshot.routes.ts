import { Router } from 'express';
import { requirePermission } from '../../middleware/auth.middleware';
import { validateUUID } from '../../middleware/uuidValidate.middleware';
import { getApplicationSnapshot, listApplicationSnapshots } from '../controllers/applicationSnapshot.controller';

const router = Router();

router.get('/:applicationId/snapshots', validateUUID('applicationId'), requirePermission('credit:read'), listApplicationSnapshots);
router.get('/:applicationId/snapshots/:snapshotId', validateUUID('applicationId'), validateUUID('snapshotId'), requirePermission('credit:read'), getApplicationSnapshot);

export default router;
