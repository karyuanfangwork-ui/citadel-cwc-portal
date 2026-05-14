import { Router } from 'express';
import { participantController } from '../controllers/participant.controller';

const router = Router({ mergeParams: true }); // mergeParams gives access to :id from parent

router.get('/', participantController.listParticipants);
router.post('/', participantController.addParticipant);
router.delete('/:userId', participantController.removeParticipant);

export default router;
