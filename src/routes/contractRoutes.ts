// Em: src/routes/contractRoutes.ts
import { Router } from 'express';
import multer from 'multer';
import {
  getAddendumSignedFile,
  getContractSignedFile,
  sendAddendumForSignature,
  sendContractForSignature,
  uploadSignedAddendumFile,
  uploadSignedContractFile,
  zapSignWebhookHandler,
} from '../controllers/contractController';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Rota para iniciar o processo de assinatura
// Protegida pelo middleware de autenticação do Firebase
router.post('/send-signature-request', requireAuth, sendContractForSignature);
router.post('/send-addendum-signature-request', requireAuth, sendAddendumForSignature);
router.post('/upload-signed-contract', requireAuth, upload.single('file'), uploadSignedContractFile);
router.post('/upload-signed-addendum', requireAuth, upload.single('file'), uploadSignedAddendumFile);
router.get('/signed-contract/:contractId', requireAuth, getContractSignedFile);
router.get('/signed-addendum/:addendumId', requireAuth, getAddendumSignedFile);

// Rota pública para o webhook do ZapSign
router.post('/webhook', zapSignWebhookHandler);

export default router;
