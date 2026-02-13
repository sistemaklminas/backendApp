# KL Minas 2025 - Backend API

API responsável por autenticação avançada, contratos/assinatura, jobs e integrações administrativas.

> Este backend pode ser mantido em repositório próprio. Este README e a pasta `backend/docs/` já estão estruturados para portabilidade.

## 1. Stack técnica

- `Node.js`
- `Express`
- `TypeScript`
- `Firebase Admin SDK` (Auth + Firestore)
- `Axios`
- `@react-pdf/renderer` (geração de PDF no backend)
- `Multer` (upload de arquivos)

## 2. Estrutura principal

```text
backend/
  src/
    server.ts
    routes/
      userRoutes.ts
      contractRoutes.ts
      jobRoutes.ts
    controllers/
      userController.ts
      contractController.tsx
      jobController.ts
      syncController.ts
    middlewares/
      authMiddleware.ts
      jobAuthMiddleware.ts
    lib/
      firebaseAdmin.ts
      firestoreApi.ts
      pdf/
  docs/
```

## 3. Scripts

```bash
npm install
npm run dev
npm run build
npm run start
```

## 4. Variáveis de ambiente (backend)

Principais variáveis lidas no código:
- `PORT`
- `FRONTEND_URL`
- `CRON_JOB_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_SERVICE_KEY`
- `ZAPSIGN_API_BASE_URL`
- `ZAPSIGN_API_TOKEN`
- `ZAPSIGN_API_TOKEN_SANDBOX`
- `ZAPSIGN_API_TOKEN_PRODUCTION`
- `ZAPSIGN_MODE` / `ZAPSIGN_ENV`
- `ZAPSIGN_PARENT_SIGNATURE_ANCHOR`
- `ZAPSIGN_SCHOOL_SIGNATURE_ANCHOR`
- `ZAPSIGN_SCHOOL_AS_SIGNER`
- `ZAPSIGN_SCHOOL_SIGNER_NAME`
- `ZAPSIGN_SCHOOL_SIGNER_EMAIL`
- `ZAPSIGN_SCHOOL_SIGNER_PHONE`
- `ZAPSIGN_DEBUG_LOG_FULL_TOKEN`

## 5. Arquivo de serviço Firebase Admin

O `server.ts` espera:
- `backend/firebase-service-account.json`

Garanta que este arquivo esteja no `.gitignore` e nunca seja versionado.

## 6. Endpoints (resumo)

Base prefix no servidor:
- `/api` (user routes)
- `/api/contracts` (contracts)
- `/api/jobs` (jobs)

Health check:
- `GET /api/health-check`

Detalhes completos em:
- `backend/docs/api.md`

## 7. Segurança

- rotas de usuário/contrato exigem Firebase ID token (`Authorization: Bearer ...`)
- rotas de job exigem `x-job-secret`
- autorização por papel em middleware (`requireRole`)

## 8. Integrações principais

- Firebase (Auth + Firestore)
- Supabase (fluxos específicos de usuário/arquivos)
- ZapSign (assinatura digital)

## 9. Documentação aprofundada

- `backend/docs/README.md`
- `backend/docs/arquitetura.md`
- `backend/docs/api.md`
- `backend/docs/seguranca-e-operacao.md`

## 10. Relação com frontend

O frontend consome esta API para funcionalidades sensíveis (contratos, jobs, claims e operações administrativas).

Consulte também:
- documentação de frontend na raiz (`README.md` e `docs/frontend/*`).
