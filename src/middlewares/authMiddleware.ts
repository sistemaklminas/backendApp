// Em: backend/src/middlewares/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// O middleware principal que verifica o token
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    const { authorization } = req.headers;

    // 1. Verifica se o cabeçalho de autorização existe e está no formato correto
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).send({ error: 'Não autorizado. Token não fornecido ou em formato inválido.' });
    }

    // 2. Extrai o token do cabeçalho
    const idToken = authorization.split('Bearer ')[1];

    try {
        // 3. Verifica o token usando o Firebase Admin SDK
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        // // 4. Anexa os dados do usuário decodificado à requisição
        // // Isso permite que os próximos middlewares e controladores saibam quem fez a requisição
        // req.user = decodedToken;

        // // 5. Passa para o próximo passo (seja outro middleware ou o controlador final)
        // return next();
        // --- PASSO DE CORREÇÃO ---
        // 1. Após verificar o token, pega o UID.
        const uid = decodedToken.uid;

        // 2. Busca o perfil do usuário no Firestore para obter o 'role'.
        const userProfileDoc = await admin.firestore().collection('userProfiles').doc(uid).get();

        if (!userProfileDoc.exists) {
            // Se o usuário existe no Auth mas não no Firestore, é um erro de integridade.
            return res.status(403).send({ error: 'Perfil de usuário não encontrado.' });
        }

        const userProfile = userProfileDoc.data();

        // 3. Anexa o token decodificado E o perfil do Firestore ao 'req.user'.
        // Agora, req.user terá uid, email, E role.
        req.user = {
            ...decodedToken,
            role: userProfile?.role,
        };
        // --- FIM DA CORREÇÃO ---

        return next();

    } catch (error) {
        console.error('Erro ao verificar o token de autenticação:', error);
        return res.status(403).send({ error: 'Token inválido ou expirado.' });
    }
};

// Um segundo middleware, mais específico, para verificar a 'role' (função) do usuário
// Ele deve ser usado DEPOIS do 'requireAuth'
export const requireRole = (roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const { user } = req; // Pega o usuário que foi decodificado pelo middleware anterior

        if (!user || !user.uid) {
            return res.status(403).send({ error: 'Usuário não encontrado na requisição.' });
        }

        try {
            // Busca o perfil do usuário no Firestore para obter a 'role'
            const userProfileSnap = await admin.firestore().collection('userProfiles').doc(user.uid).get();

            if (!userProfileSnap.exists) {
                return res.status(404).send({ error: 'Perfil de usuário não encontrado no Firestore.' });
            }

            const userRole = userProfileSnap.data()?.role;

            // Verifica se a 'role' do usuário está na lista de 'roles' permitidas
            if (roles.includes(userRole)) {
                return next(); // Permissão concedida, continua para o controlador
            } else {
                return res.status(403).send({ error: 'Permissão negada. Você não tem a função necessária para este recurso.' });
            }
        } catch (error) {
            console.error('Erro ao verificar a função do usuário:', error);
            return res.status(500).send({ error: 'Erro interno ao verificar permissões.' });
        }
    };
};
