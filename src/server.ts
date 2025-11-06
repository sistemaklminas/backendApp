// Em: backend/src/server.ts

import express from 'express';
import cors from 'cors';
import * as admin from 'firebase-admin';
import 'dotenv/config'; // Carrega as variáveis de ambiente do .env

// --- 1. INICIALIZAÇÃO DO FIREBASE ADMIN ---
// Pegue este JSON do seu console do Firebase:
// Project Settings > Service accounts > Generate new private key
// Salve-o como 'firebase-service-account.json' na pasta 'backend'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Importe as novas rotas
import userRoutes from './routes/userRoutes';
import jobRoutes from './routes/jobRoutes';

// --- 2. INICIALIZAÇÃO DO EXPRESS ---
const app = express();

// Middlewares essenciais
// app.use(cors({ origin: true })); // Permite requisições do seu frontend
// --- CONFIGURAÇÃO DE CORS DINÂMICA ---
const allowedOrigins = [
    'http://localhost:5173', // Sua URL de desenvolvimento do frontend
    'https://app.klminasesportes.com.br' // <<< COLOQUE A URL DO SEU FRONTEND DEPOIS
];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Permite requisições sem 'origin' (como Postman, apps mobile)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'A política de CORS para este site não permite acesso da origem especificada.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
};
app.use(cors(corsOptions));
// --- FIM DA CONFIGURAÇÃO DE CORS ---
app.use(express.json()); // Permite que o servidor entenda JSON no corpo das requisições

// --- 3. ROTA DE TESTE (HEALTH CHECK) ---
app.get('/api/health-check', (req, res) => {
    res.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- CONECTE AS ROTAS DE USUÁRIO ---
// Todas as rotas definidas em 'userRoutes' serão prefixadas com '/api'
app.use('/api', userRoutes);
app.use('/api/jobs', jobRoutes);

// --- 4. INICIAR O SERVIDOR ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
