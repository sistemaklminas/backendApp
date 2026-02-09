// Em: src/routes/contractRoutes.ts
import { Router } from 'express';
import { sendAddendumForSignature, sendContractForSignature, zapSignWebhookHandler } from '../controllers/contractController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// Rota para iniciar o processo de assinatura
// Protegida pelo middleware de autenticação do Firebase
router.post('/send-signature-request', requireAuth, sendContractForSignature);
router.post('/send-addendum-signature-request', requireAuth, sendAddendumForSignature);

// Rota pública para o webhook do ZapSign
router.post('/webhook', zapSignWebhookHandler);

export default router;
