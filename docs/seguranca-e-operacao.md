# Segurança e Operação (Backend)

## 1. Segurança

## 1.1 Tokens
- validar sempre `Authorization: Bearer <idToken>`
- nunca logar token completo em produção

## 1.2 Papéis
- aplicar `requireRole` para operações administrativas
- evitar confiar apenas no frontend para bloqueio de ação

## 1.3 Jobs
- proteger endpoints com `x-job-secret`
- rotacionar `CRON_JOB_SECRET` periodicamente

## 1.4 Segredos e credenciais
- manter `.env` e service account fora do versionamento
- usar variáveis de ambiente por ambiente (dev/stage/prod)

## 2. Operação

## 2.1 Subida local
```bash
npm install
npm run dev
```

## 2.2 Build/execução
```bash
npm run build
npm run start
```

## 2.3 Health check
- endpoint: `GET /api/health-check`
- use em monitoramento e smoke tests pós-deploy

## 3. Troubleshooting

## 3.1 Erro de CORS
- validar domínio no allowlist de `server.ts`
- confirmar origem real da chamada (webview, preview, etc.)

## 3.2 Falha em assinatura digital
- validar variáveis ZapSign
- conferir modo (`sandbox`/`production`)
- verificar webhook e atualização de status no Firestore

## 3.3 Falha de permissão
- conferir `userProfiles.role`
- verificar middleware aplicado na rota

## 3.4 Falha com Firebase Admin
- confirmar caminho e conteúdo do service account
- validar permissões do projeto Firebase

## 4. Boas práticas de manutenção

- registrar alterações de endpoint em `backend/docs/api.md`
- manter logs com contexto de contrato/usuário sem dados sensíveis
- documentar novos jobs e segredos operacionais
