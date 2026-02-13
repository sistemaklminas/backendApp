import { Router } from 'express';
import {
  createLandingLead,
  listLandingLeads,
  updateLandingLeadStatus,
} from '../controllers/leadController';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';

const router = Router();
const leadManagers = ['root', 'admin'];

// Público: formulário da landing
router.post('/landing-leads', createLandingLead);

// Protegido: gestão dos leads
router.get('/landing-leads', requireAuth, requireRole(leadManagers), listLandingLeads);
router.patch(
  '/landing-leads/:leadId/status',
  requireAuth,
  requireRole(leadManagers),
  updateLandingLeadStatus,
);

export default router;

