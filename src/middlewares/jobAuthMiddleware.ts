// Em: backend/src/middlewares/jobAuthMiddleware.ts

import { type Request, type Response, type NextFunction } from 'express';

export const requireJobSecret = (req: Request, res: Response, next: NextFunction) => {
    const providedSecret = req.headers['x-job-secret'];
    const expectedSecret = process.env.CRON_JOB_SECRET;

    if (!expectedSecret) {
        console.error('CRON_JOB_SECRET não está definido nas variáveis de ambiente.');
        return res.status(500).send({ error: 'Erro de configuração do servidor.' });
    }

    if (providedSecret === expectedSecret) {
        next(); // Chave correta, pode prosseguir
    } else {
        console.warn('Tentativa de acesso não autorizado ao endpoint de job.');
        res.status(403).send({ error: 'Acesso não autorizado.' });
    }
};
