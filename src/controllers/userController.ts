/* eslint-disable @typescript-eslint/no-explicit-any */
// Em: backend/src/controllers/userController.ts

import { type Response } from 'express';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { createClient } from '@supabase/supabase-js';

// --- INICIALIZAÇÃO DO CLIENTE SUPABASE (somente com chaves de ambiente) ---
// Usaremos as variáveis de ambiente que configuramos no Render.
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_KEY!
);

// --- 1. PAYLOAD ALINHADO COM SUA TIPAGEM ---
// Este é o formato de dados que o frontend deve enviar.
interface CreateUserPayload {
    email: string;
    password: string; // Senha agora é obrigatória
    name: string;
    role: "root" | "admin" | "editor" | "teacher" | "user";
    phone?: string;
    document?: string;
    // 'photoUrl' e 'isActive' serão definidos pelo backend.
}

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { email, password, name, role, phone, document } = req.body as CreateUserPayload;

        // --- Validação Aprimorada ---
        if (!email || !password || !name || !role) {
            return res.status(400).send({ error: 'Email, senha, nome e função são obrigatórios.' });
        }

        // --- 2. LÓGICA DO CONTADOR 'publicId' ---
        const counterRef = admin.firestore().collection('counters').doc('userProfiles');

        // Usamos uma transação para garantir que a leitura e a escrita do contador sejam atômicas.
        // Isso evita que dois usuários sejam criados com o mesmo publicId ao mesmo tempo.
        const newPublicId = await admin.firestore().runTransaction<number>(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists) {
                // Se o contador não existe, começa em 1.
                const nextId = 1;
                transaction.set(counterRef, { currentId: nextId });
                return nextId;
            } else {
                // Se existe, incrementa o valor atual.
                const currentId = counterDoc.data()?.currentId || 0;
                const nextId = currentId + 1;
                transaction.update(counterRef, { currentId: nextId });
                return nextId;
            }
        });

        // Pega o UID do admin que está fazendo a requisição, injetado pelo middleware
        const adminUid = req.user?.uid;
        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }

        // --- 3. Criar usuário no Firebase Auth ---
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            phoneNumber: phone, // Se 'phone' for undefined, o Firebase ignora.
        });

        const uid = userRecord.uid;

        // --- 4. Criar o perfil no Firestore com a estrutura correta ---
        const userProfileRef = admin.firestore().collection('userProfiles').doc(uid);

        // Monta o objeto do perfil do usuário
        const userProfileData = {
            id: uid,
            publicId: newPublicId, // Usa o ID do contador
            name,
            email,
            role,
            phone: phone || null, // Garante que o campo exista, mesmo que nulo
            document: document || null, // Garante que o campo exista, mesmo que nulo
            photoUrl: null, // Começa sem foto
            isActive: true, // Usuários criados pelo admin começam ativos

            createdBy: adminUid,
            updatedBy: adminUid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await userProfileRef.set(userProfileData);

        // --- 5. Retornar resposta de sucesso ---
        console.log(`Usuário ${name} (UID: ${uid}, PublicID: ${newPublicId}) criado com sucesso.`);
        return res.status(201).send({
            message: 'Usuário criado com sucesso!',
            user: userProfileData, // Retorna o perfil completo criado
        });


    } catch (error: any) {
        console.error('Erro ao criar usuário:', error);

        if (error.code === 'auth/email-already-exists') {
            return res.status(409).send({ error: 'O email fornecido já está em uso.' });
        }
        if (error.code === 'auth/invalid-password') {
            return res.status(400).send({ error: 'A senha deve ter no mínimo 6 caracteres.' });
        }

        return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
    }
};

// Tipagem para o corpo da requisição de atualização
interface UpdateUserPayload {
    email?: string;
    password?: string; // Senha é opcional na atualização
    name?: string;
    role?: "root" | "admin" | "editor" | "teacher" | "user";
    phone?: string;
    document?: string;
    isActive?: boolean;
}

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params; // Pega o ID do usuário a ser atualizado da URL
        const data = req.body as UpdateUserPayload;
        const adminUid = req.user?.uid;

        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).send({ error: 'Nenhum dado fornecido para atualização.' });
        }

        // --- 1. Atualizar o Firebase Auth ---
        const authUpdatePayload: admin.auth.UpdateRequest = {};
        if (data.email) authUpdatePayload.email = data.email;
        if (data.password) authUpdatePayload.password = data.password;
        if (data.name) authUpdatePayload.displayName = data.name;
        if (data.phone) authUpdatePayload.phoneNumber = data.phone;

        if (Object.keys(authUpdatePayload).length > 0) {
            await admin.auth().updateUser(userId, authUpdatePayload);
        }

        // --- 2. Atualizar o perfil no Firestore ---
        const firestoreUpdatePayload: { [key: string]: any } = {};
        // Mapeia os campos do payload para o objeto de atualização do Firestore
        for (const key in data) {
            if (key !== 'password') { // Nunca salvamos a senha no Firestore
                firestoreUpdatePayload[key] = data[key as keyof typeof data];
            }
        }
        firestoreUpdatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        firestoreUpdatePayload.updatedBy = adminUid;

        const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
        await userProfileRef.update(firestoreUpdatePayload);

        console.log(`Usuário (UID: ${userId}) atualizado com sucesso pelo admin (UID: ${adminUid}).`);
        return res.status(200).send({ message: 'Usuário atualizado com sucesso!' });

    } catch (error: any) {
        console.error(`Erro ao atualizar usuário ${req.params.userId}:`, error);
        if (error.code === 'auth/user-not-found') {
            return res.status(404).send({ error: 'Usuário não encontrado no Firebase Authentication.' });
        }
        if (error.code === 'auth/email-already-exists') {
            return res.status(409).send({ error: 'O email fornecido já está em uso por outro usuário.' });
        }
        return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
    }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const adminUid = req.user?.uid;

        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }

        // --- 1. Deletar do Firebase Auth ---
        await admin.auth().deleteUser(userId);

        // --- 2. Deletar do Firestore ---
        const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
        await userProfileRef.delete();

        // TODO: Implementar a lógica de log, se necessário.
        // A função antiga criava um log. Podemos replicar isso aqui.
        // await admin.firestore().collection('logs').add({ ... });

        console.log(`Usuário (UID: ${userId}) deletado com sucesso pelo admin (UID: ${adminUid}).`);
        return res.status(200).send({ message: 'Usuário deletado com sucesso.' });

    } catch (error: any) {
        console.error(`Erro ao deletar usuário ${req.params.userId}:`, error);
        if (error.code === 'auth/user-not-found') {
            // Se o usuário não existe no Auth, talvez ainda exista no Firestore.
            // Tentamos deletar do Firestore mesmo assim.
            try {
                await admin.firestore().collection('userProfiles').doc(req.params.userId).delete();
                return res.status(200).send({ message: 'Usuário não encontrado no Auth, mas perfil do Firestore foi removido.' });
            } catch (dbError) {
                console.error('Erro ao deletar perfil do Firestore:', dbError);
                return res.status(404).send({ error: 'Usuário não encontrado no Auth nem no Firestore.' });
            }
        }
        return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
    }
};

// export const clearPasswordClaim = async (req: AuthenticatedRequest, res: Response) => {
//     const uid = req.user?.uid;
//     if (!uid) {
//         return res.status(403).send({ error: 'Usuário não autenticado.' });
//     }

//     try {
//         // Remove todos os custom claims, o que reverte o usuário ao estado normal
//         await admin.auth().setCustomUserClaims(uid, null);
//         console.log(`Claim de mudança de senha removido para o usuário ${uid}.`);
//         return res.status(200).send({ message: 'Claim removido com sucesso.' });
//     } catch (error) {
//         console.error(`Erro ao remover claim para o usuário ${uid}:`, error);
//         return res.status(500).send({ error: 'Erro interno ao remover claim.' });
//     }
// };

export const clearPasswordClaim = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.uid;

    try {
        // 1. Pega os claims atuais do usuário
        const { customClaims } = await admin.auth().getUser(userId);

        // Se não houver claims ou o claim específico não existir, não faz nada.
        if (!customClaims || !customClaims.mustChangePassword) {
            return res.status(200).send({ message: 'Nenhum claim para limpar.' });
        }

        // 2. Cria um novo objeto de claims, omitindo APENAS o 'mustChangePassword'
        // Esta é a "desestruturação com resto" que remove a propriedade.
        const { mustChangePassword, ...remainingClaims } = customClaims;

        // 3. Salva de volta APENAS os claims restantes (como o 'role')
        await admin.auth().setCustomUserClaims(userId, remainingClaims);

        console.log(`Claim 'mustChangePassword' [${mustChangePassword}] removido para o usuário ${userId}. Claims restantes:`, remainingClaims);
        res.status(200).send({ message: 'Claim de senha removido com sucesso.' });

    } catch (error: any) {
        console.error(`Erro ao limpar claim de senha para ${userId}:`, error);
        res.status(500).send({ error: 'Falha ao remover o claim de senha.' });
    }
};

/**
 * Baixa um arquivo de contrato privado do Supabase e o serve para o cliente.
 * Acesso é verificado pelo middleware de autenticação.
 */
export const getContractFile = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const requestingUser = req.user;

        if (!requestingUser) {
            return res.status(403).send({ error: 'Usuário não autenticado.' });
        }

        // --- Lógica de Autorização ---
        const studentRef = admin.firestore().collection('students').doc(studentId);
        const studentDoc = await studentRef.get();

        if (!studentDoc.exists) {
            return res.status(404).send({ error: 'Aluno não encontrado.' });
        }

        const studentData = studentDoc.data()!;
        const userProfileRef = admin.firestore().collection('userProfiles').doc(requestingUser.uid);
        const userProfileDoc = await userProfileRef.get();
        const userRole = userProfileDoc.data()?.role;

        // Permite o acesso se:
        // 1. O usuário for admin/root.
        // 2. O UID do usuário que fez a requisição for o mesmo do pai/responsável do aluno.
        const isAuthorized =
            ['root', 'admin', 'editor'].includes(userRole) ||
            requestingUser.uid === studentData.parentOneId ||
            requestingUser.uid === studentData.parentTwoId ||
            requestingUser.uid === studentData.financialResponsibleId;

        if (!isAuthorized) {
            return res.status(403).send({ error: 'Você não tem permissão para visualizar este contrato.' });
        }

        if (!studentData.contractPath) {
            return res.status(404).send({ error: 'Este aluno não possui um contrato salvo.' });
        }

        // --- Download do Arquivo do Supabase ---
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('contracts')
            .download(studentData.contractPath);

        if (downloadError) {
            throw downloadError;
        }

        // --- Servir o Arquivo para o Frontend ---
        // Converte o Blob para um Buffer
        const buffer = Buffer.from(await fileData.arrayBuffer());

        // Define os cabeçalhos da resposta para indicar que é um PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contrato.pdf"`); // 'inline' sugere ao navegador para abrir, não baixar

        // Envia o buffer do arquivo como resposta
        res.send(buffer);

    } catch (error: any) {
        console.error(`Erro ao buscar contrato para o aluno ${req.params.studentId}:`, error);
        res.status(500).send({ error: 'Não foi possível carregar o contrato.' });
    }
};

/**
 * Adiciona um custom claim ao token do usuário ROOT para emular outro usuário.
 * Apenas um root pode chamar isso. O ID do usuário a ser emulado vem no body.
 */
export const emulateUser = async (req: AuthenticatedRequest, res: Response) => {
    // O middleware já garante que quem chama é um usuário autenticado.
    // Agora, verificamos se ele é ROOT.
    if (req.user?.role !== 'root') {
        return res.status(403).send({ error: 'Apenas administradores root podem emular usuários.' });
    }

    const { userIdToEmulate } = req.body;
    if (!userIdToEmulate) {
        return res.status(400).send({ error: 'O ID do usuário a ser emulado é obrigatório.' });
    }

    const rootUserId = req.user.uid; // O ID do próprio root

    try {
        // Pega os claims atuais do root para não sobrescrevê-los
        const { customClaims } = await admin.auth().getUser(rootUserId);

        // Adiciona o novo claim de emulação
        await admin.auth().setCustomUserClaims(rootUserId, {
            ...customClaims,
            emulated_uid: userIdToEmulate,
        });

        console.log(`Root ${rootUserId} agora está emulando ${userIdToEmulate}`);
        res.status(200).send({ message: 'Emulação iniciada com sucesso.' });
    } catch (error: any) {
        console.error('Erro ao iniciar emulação:', error);
        res.status(500).send({ error: 'Falha ao definir o claim de emulação.' });
    }
};

/**
 * Remove o claim de emulação do token do usuário ROOT.
 */
export const stopEmulation = async (req: AuthenticatedRequest, res: Response) => {
    if (req.user?.role !== 'root') {
        return res.status(403).send({ error: 'Ação não permitida.' });
    }

    const rootUserId = req.user.uid;

    try {
        const { customClaims } = await admin.auth().getUser(rootUserId);

        // Cria um novo objeto de claims sem a propriedade 'emulated_uid'
        const { emulated_uid, ...newClaims } = customClaims || {};

        await admin.auth().setCustomUserClaims(rootUserId, newClaims);

        console.log(`Root ${rootUserId} parou a emulação de ${emulated_uid}.`);
        res.status(200).send({ message: 'Emulação finalizada com sucesso.' });
    } catch (error: any) {
        console.error('Erro ao parar emulação:', error);
        res.status(500).send({ error: 'Falha ao remover o claim de emulação.' });
    }
};

/**
 * Limpa o claim 'mustChangePassword' do token do próprio usuário que está fazendo a requisição.
 * Isso é chamado pelo frontend DEPOIS que o usuário troca a senha com sucesso.
 */
// export const clearPasswordClaim = async (req: AuthenticatedRequest, res: Response) => {
//     // O middleware 'requireAuth' já garante que temos um usuário autenticado.
//     const userId = req.user!.uid;

//     try {
//         const { customClaims } = await admin.auth().getUser(userId);

//         // Se o claim não existir, não há nada a fazer.
//         if (!customClaims || !customClaims.mustChangePassword) {
//             return res.status(200).send({ message: 'Nenhum claim para limpar.' });
//         }

//         // Cria um novo objeto de claims sem a propriedade 'mustChangePassword'
//         const { mustChangePassword, ...newClaims } = customClaims;

//         await admin.auth().setCustomUserClaims(userId, newClaims);

//         console.log(`Claim 'mustChangePassword' [${mustChangePassword}] removido para o usuário ${userId}`);
//         res.status(200).send({ message: 'Claim de senha removido com sucesso.' });
//     } catch (error: any) {
//         console.error(`Erro ao limpar claim de senha para ${userId}:`, error);
//         res.status(500).send({ error: 'Falha ao remover o claim de senha.' });
//     }
// };