# API Reference (Backend)

Base URL local padrão:
- `http://localhost:<PORT>/api`

## 1. Health

### `GET /api/health-check`
Retorna status da API.

Resposta exemplo:
```json
{ "status": "ok", "timestamp": "2026-02-13T10:00:00.000Z" }
```

## 2. Usuários

Prefixo em `server.ts`: `/api`

### `POST /users/create`
Cria usuário no Auth + perfil no Firestore.

Auth:
- `Authorization: Bearer <idToken>`
- papéis permitidos: `root`, `admin`, `editor`

### `PUT /users/:userId`
Atualiza dados de usuário.

### `DELETE /users/:userId`
Remove usuário.

### `POST /users/clear-password-claim`
Limpa claim de troca obrigatória de senha do próprio usuário autenticado.

### `GET /contracts/view/:studentId`
Retorna contrato para visualização conforme autorização do solicitante.

## 3. Contratos

Prefixo em `server.ts`: `/api/contracts`

### `POST /send-signature-request`
Dispara fluxo de assinatura de contrato.

### `POST /send-addendum-signature-request`
Dispara fluxo de assinatura de aditivo.

### `POST /upload-signed-contract`
Upload de contrato assinado (multipart, campo `file`).

### `POST /upload-signed-addendum`
Upload de aditivo assinado (multipart, campo `file`).

### `GET /signed-contract/:contractId`
Obtém URL/arquivo assinado de contrato.

### `GET /signed-addendum/:addendumId`
Obtém URL/arquivo assinado de aditivo.

### `POST /webhook`
Webhook público para eventos da ZapSign.

## 4. Jobs

Prefixo em `server.ts`: `/api/jobs`

### `POST /check-pending-contracts`
Executa rotina de verificação de contratos pendentes/vencidos.

Auth:
- header `x-job-secret: <CRON_JOB_SECRET>`

### `POST /process-waitlist-expirations`
Expira ofertas da fila, move o aluno para o final da fila e registra auditoria.

Auth:
- header `x-job-secret: <CRON_JOB_SECRET>`

## 5. Autenticação e autorização

## 5.1 Auth
- formato obrigatório: `Authorization: Bearer <Firebase ID Token>`

## 5.2 Roles
Validadas por `requireRole` após `requireAuth`.

## 6. Erros e padrões de resposta

A API retorna códigos HTTP padrão (`400`, `401`, `403`, `404`, `409`, `500`) com payload JSON contendo `error`/`message`.

## 7. Observações

- limites de upload em contratos: 10 MB (multer memory storage)
- CORS configurado via allowlist no servidor
