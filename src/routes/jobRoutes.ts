// Em: backend/src/routes/jobRoutes.ts

import { Router } from 'express';
import { checkPendingContractsJob } from '../controllers/jobController';
import { requireJobSecret } from '../middlewares/jobAuthMiddleware';

const router = Router();

// Aplica o middleware de segurança a esta rota
router.post('/check-pending-contracts', requireJobSecret, checkPendingContractsJob);

export default router;
