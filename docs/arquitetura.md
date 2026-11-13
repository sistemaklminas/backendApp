# Arquitetura Backend

## 1. Objetivo

Expor serviços HTTP para operações sensíveis que não devem rodar no frontend:

- criação/gestão de usuários com privilégios
- integração com assinatura digital
- jobs operacionais
- validações e autorizações centralizadas

## 2. Componentes

## 2.1 `server.ts`

- inicializa Express
- configura CORS
- registra middlewares globais
- conecta rotas

## 2.2 `routes/*`

- mapeiam endpoints e middlewares:
  - `userRoutes.ts`
  - `contractRoutes.ts`
  - `jobRoutes.ts`

## 2.3 `middlewares/*`

- `requireAuth`: valida Firebase token
- `requireRole`: autorização por papel
- `requireJobSecret`: protege endpoints de cron

## 2.4 `controllers/*`

- `userController.ts`: criação/atualização/remoção de usuário, claims
- `contractController.tsx`: contratos, aditivos, ZapSign, webhook, uploads
- `jobController.ts`: rotinas automatizadas
- `syncController.ts`: sincronizações entre entidades

## 2.5 `lib/*`

- `firebaseAdmin.ts`: acesso admin ao Firebase
- `firestoreApi.ts`: consultas agregadas
- `pdf/*`: documentos em PDF (contrato/aditivo)

## 3. Modelo de segurança

1. autenticação via Firebase ID Token
2. autorização por papel no Firestore (`userProfiles.role`)
3. segredo dedicado para jobs (`x-job-secret`)
4. validação de acesso de responsável em endpoints de contrato

## 4. Fluxo de contrato (alto nível)

1. frontend solicita envio para assinatura
2. backend busca sessão de contrato no Firestore
3. backend gera PDF e envia à ZapSign
4. backend salva token/status/urls
5. webhook da ZapSign atualiza status para assinado
6. frontend consulta URL do arquivo assinado

## 5. Considerações de operação

- CORS com allowlist explícita
- logs de integração (incluindo modo ZapSign)
- endpoints de health-check para monitoramento

## 6. Evolução recomendada

- padronizar validação de payloads por schema
- separar camada de serviço dos controladores
- ampliar observabilidade (correlation-id e logs estruturados)
