// Em: backend/src/routes/userRoutes.ts

import { Router } from 'express';
import { clearPasswordClaim, createUser, deleteUser, emulateUser, getContractFile, stopEmulation, updateUser } from '../controllers/userController';
import { requireAuth, requireRole } from '../middlewares/authMiddleware'

const router = Router();

const adminRoles = ['root', 'admin', 'editor'];

// Rota para CRIAR usuário
router.post('/users/create', requireAuth, requireRole(adminRoles), createUser);

// Rota para ATUALIZAR um usuário específico
// :userId é um parâmetro dinâmico na URL
router.put('/users/:userId', requireAuth, requireRole(adminRoles), updateUser);

// Rota para DELETAR um usuário específico
router.delete('/users/:userId', requireAuth, requireRole(adminRoles), deleteUser);

// Rota para o próprio usuário limpar seu claim de mudança de senha
// Note que não precisa de 'requireRole', pois o próprio usuário logado pode fazer isso.
router.post('/users/clear-password-claim', requireAuth, clearPasswordClaim);

// Rota para visualizar um contrato.
// Apenas requer autenticação. A autorização (se é o pai certo) é feita no controlador.
router.get('/contracts/view/:studentId', requireAuth, getContractFile);

// --- ROTAS DE EMULAÇÃO ---
// Protegidas pelo mesmo middleware, a lógica de permissão (ser root) fica no controller.
router.post('/users/emulate', requireAuth, emulateUser);
router.post('/users/stop-emulation', requireAuth, stopEmulation);


export default router;
