import { Router } from 'express';
import { provisionPublicEnrollmentUsers } from '../controllers/publicEnrollmentController';
import { requireAnonymousAuth } from '../middlewares/authMiddleware';

const router = Router();
router.post('/public-enrollments/provision-users', requireAnonymousAuth, provisionPublicEnrollmentUsers);

export default router;
