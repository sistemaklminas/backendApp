/* eslint-disable @typescript-eslint/no-explicit-any */
// Em: backend/src/controllers/userController.ts

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// --- INICIALIZAÇÃO DO CLIENTE SUPABASE (somente com chaves de ambiente) ---
// Usaremos as variáveis de ambiente que configuramos no Render.
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_KEY!
);

function toE164BR(phone?: string): string | undefined {
    if (!phone) return undefined;

    const digits = phone.replace(/\D/g, '');

    // precisa ter DDD(2) + número(8 ou 9) => 10 ou 11 dígitos
    if (!/^\d{10,11}$/.test(digits)) return undefined;

    return `+55${digits}`;
}


// --- 1. PAYLOAD ALINHADO COM SUA TIPAGEM ---
// Este é o formato de dados que o frontend deve enviar.
interface CreateUserPayload {
    email: string;
    password: string; // Senha agora é obrigatória
    name: string;
    role: "root" | "admin" | "editor" | 'coordinator' | "teacher" | "user";
    phone?: string;
    document?: string;
    // 'photoUrl' e 'isActive' serão definidos pelo backend.
}

// export const createUser = async (req: Request, res: Response) => {
//     try {
//         const { email, password, name, role, phone, document } = req.body as CreateUserPayload;

//         // --- Validação Aprimorada ---
//         if (!email || !password || !name || !role) {
//             return res.status(400).send({ error: 'Email, senha, nome e função são obrigatórios.' });
//         }

//         // --- 2. LÓGICA DO CONTADOR 'publicId' ---
//         const counterRef = admin.firestore().collection('counters').doc('userProfiles');

//         // Usamos uma transação para garantir que a leitura e a escrita do contador sejam atômicas.
//         // Isso evita que dois usuários sejam criados com o mesmo publicId ao mesmo tempo.
//         const newPublicId = await admin.firestore().runTransaction<number>(async (transaction) => {
//             const counterDoc = await transaction.get(counterRef);
//             if (!counterDoc.exists) {
//                 // Se o contador não existe, começa em 1.
//                 const nextId = 1;
//                 transaction.set(counterRef, { lastId: nextId });
//                 return nextId;
//             } else {
//                 // Se existe, incrementa o valor atual.
//                 const lastId = counterDoc.data()?.lastId || 0;
//                 const nextId = lastId + 1;
//                 transaction.update(counterRef, { lastId: nextId });
//                 return nextId;
//             }
//         });

//         // Pega o UID do admin que está fazendo a requisição, injetado pelo middleware
//         const adminUid = req.user?.uid;
//         if (!adminUid) {
//             return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
//         }

//         // --- 3. Criar usuário no Firebase Auth ---
//         const userRecord = await admin.auth().createUser({
//             email,
//             password,
//             displayName: name,
//             phoneNumber: phone, // Se 'phone' for undefined, o Firebase ignora.
//         });

//         const uid = userRecord.uid;

//         // --- 4. Criar o perfil no Firestore com a estrutura correta ---
//         const userProfileRef = admin.firestore().collection('userProfiles').doc(uid);

//         // Monta o objeto do perfil do usuário
//         const userProfileData = {
//             id: uid,
//             publicId: newPublicId, // Usa o ID do contador
//             name,
//             email,
//             role,
//             phone: phone || null, // Garante que o campo exista, mesmo que nulo
//             document: document || null, // Garante que o campo exista, mesmo que nulo
//             photoUrl: null, // Começa sem foto
//             isActive: true, // Usuários criados pelo admin começam ativos

//             createdBy: adminUid,
//             updatedBy: adminUid,
//             createdAt: admin.firestore.FieldValue.serverTimestamp(),
//             updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//         };

//         await userProfileRef.set(userProfileData);

//         // --- 5. Retornar resposta de sucesso ---
//         console.log(`Usuário ${name} (UID: ${uid}, PublicID: ${newPublicId}) criado com sucesso.`);
//         return res.status(201).send({
//             message: 'Usuário criado com sucesso!',
//             user: userProfileData, // Retorna o perfil completo criado
//         });


//     } catch (error: any) {
//         console.error('Erro ao criar usuário:', error);

//         if (error.code === 'auth/email-already-exists') {
//             return res.status(409).send({ error: 'O email fornecido já está em uso.' });
//         }
//         if (error.code === 'auth/invalid-password') {
//             return res.status(400).send({ error: 'A senha deve ter no mínimo 6 caracteres.' });
//         }

//         return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
//     }
// };

// Tipagem para o corpo da requisição de atualização

export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role, phone, document } = req.body as CreateUserPayload;

        // --- Validação ---
        if (!email || !password || !name || !role) {
            return res.status(400).send({ error: 'Email, senha, nome e função são obrigatórios.' });
        }

        // Teacher exige phone obrigatório
        if (role === 'teacher' && !phone) {
            return res.status(400).send({ error: 'Para criar um professor, o telefone é obrigatório.' });
        }

        // --- Contador do user publicId ---
        const counterRef = admin.firestore().collection('counters').doc('userProfiles');

        const newPublicId = await admin.firestore().runTransaction<number>(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists) {
                const nextId = 1;
                transaction.set(counterRef, { lastId: nextId });
                return nextId;
            } else {
                const lastId = counterDoc.data()?.lastId || 0;
                const nextId = lastId + 1;
                transaction.update(counterRef, { lastId: nextId });
                return nextId;
            }
        });

        const adminUid = req.user?.uid;
        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }

        const e164Phone = toE164BR(phone);

        // --- Criar usuário no Firebase Auth ---
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            ...(e164Phone ? { phoneNumber: e164Phone } : {}), // se undefined, ignora
        });

        const uid = userRecord.uid;

        // --- Criar perfil do usuário no Firestore ---
        const userProfileRef = admin.firestore().collection('userProfiles').doc(uid);

        const userProfileData = {
            id: uid,
            publicId: newPublicId,
            name,
            email,
            role,
            phone: phone || null,
            document: document || null,
            photoUrl: null,
            isActive: true,

            createdBy: adminUid,
            updatedBy: adminUid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await userProfileRef.set(userProfileData);

        // --- Se for teacher, criar teacher profile ---
        if (role === 'teacher') {
            const teacherCounterRef = admin.firestore().collection('counters').doc('teacherProfiles');

            const newTeacherPublicId = await admin.firestore().runTransaction<number>(async (transaction) => {
                const counterDoc = await transaction.get(teacherCounterRef);
                if (!counterDoc.exists) {
                    const nextId = 1;
                    transaction.set(teacherCounterRef, { lastId: nextId });
                    return nextId;
                } else {
                    const lastId = counterDoc.data()?.lastId || 0;
                    const nextId = lastId + 1;
                    transaction.update(teacherCounterRef, { lastId: nextId });
                    return nextId;
                }
            });

            const teacherRef = admin.firestore().collection('teachers').doc(uid);

            await teacherRef.set({
                id: uid,
                publicId: newTeacherPublicId,
                name,
                email,
                phone, // aqui phone é obrigatório (já validamos)
                authUid: uid,
                isActive: true,

                createdBy: adminUid,
                updatedBy: adminUid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        console.log(`Usuário ${name} (UID: ${uid}, PublicID: ${newPublicId}) criado com sucesso.`);
        return res.status(201).send({
            message: 'Usuário criado com sucesso!',
            user: userProfileData,
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


interface UpdateUserPayload {
    email?: string;
    password?: string; // Senha é opcional na atualização
    name?: string;
    role?: "root" | "admin" | "editor" | "teacher" | "user";
    phone?: string;
    document?: string;
    isActive?: boolean;
}

// export const updateUser = async (req: Request, res: Response) => {
//     try {
//         const { userId } = req.params; // Pega o ID do usuário a ser atualizado da URL
//         const data = req.body as UpdateUserPayload;
//         const adminUid = req.user?.uid;

//         if (!adminUid) {
//             return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
//         }
//         if (Object.keys(data).length === 0) {
//             return res.status(400).send({ error: 'Nenhum dado fornecido para atualização.' });
//         }

//         // --- 1. Atualizar o Firebase Auth ---
//         const authUpdatePayload: admin.auth.UpdateRequest = {};
//         if (data.email) authUpdatePayload.email = data.email;
//         if (data.password) authUpdatePayload.password = data.password;
//         if (data.name) authUpdatePayload.displayName = data.name;
//         if (data.phone) authUpdatePayload.phoneNumber = data.phone;

//         if (Object.keys(authUpdatePayload).length > 0) {
//             await admin.auth().updateUser(userId, authUpdatePayload);
//         }

//         // --- 2. Atualizar o perfil no Firestore ---
//         const firestoreUpdatePayload: { [key: string]: any } = {};
//         // Mapeia os campos do payload para o objeto de atualização do Firestore
//         for (const key in data) {
//             if (key !== 'password') { // Nunca salvamos a senha no Firestore
//                 firestoreUpdatePayload[key] = data[key as keyof typeof data];
//             }
//         }
//         firestoreUpdatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
//         firestoreUpdatePayload.updatedBy = adminUid;

//         const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
//         await userProfileRef.update(firestoreUpdatePayload);

//         console.log(`Usuário (UID: ${userId}) atualizado com sucesso pelo admin (UID: ${adminUid}).`);
//         return res.status(200).send({ message: 'Usuário atualizado com sucesso!' });

//     } catch (error: any) {
//         console.error(`Erro ao atualizar usuário ${req.params.userId}:`, error);
//         if (error.code === 'auth/user-not-found') {
//             return res.status(404).send({ error: 'Usuário não encontrado no Firebase Authentication.' });
//         }
//         if (error.code === 'auth/email-already-exists') {
//             return res.status(409).send({ error: 'O email fornecido já está em uso por outro usuário.' });
//         }
//         return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
//     }
// };


export const updateUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const data = req.body as UpdateUserPayload;
        const adminUid = req.user?.uid;

        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).send({ error: 'Nenhum dado fornecido para atualização.' });
        }

        const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
            return res.status(404).send({ error: 'Usuário não encontrado no Firestore.' });
        }

        const existingProfile = userProfileSnap.data() as any;
        const previousRole = existingProfile?.role as string | undefined;

        // --- 1. Atualizar Firebase Auth ---
        const authUpdatePayload: admin.auth.UpdateRequest = {};
        if (data.email) authUpdatePayload.email = data.email;
        if (data.password) authUpdatePayload.password = data.password;
        if (data.name) authUpdatePayload.displayName = data.name;
        if (data.phone) {
            const e164Phone = toE164BR(data.phone);
            if (!e164Phone) {
                return res.status(400).send({ error: 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).' });
            }
            authUpdatePayload.phoneNumber = e164Phone;
        }

        if (Object.keys(authUpdatePayload).length > 0) {
            await admin.auth().updateUser(userId, authUpdatePayload);
        }

        // --- 2. Atualizar userProfiles/{uid} ---
        const firestoreUpdatePayload: Record<string, any> = {};
        for (const key in data) {
            const value = data[key as keyof typeof data];
            if (key !== 'password' && value !== undefined) {
                firestoreUpdatePayload[key] = value;
            }
        }
        firestoreUpdatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        firestoreUpdatePayload.updatedBy = adminUid;

        await userProfileRef.update(firestoreUpdatePayload);

        // --- 3. Teacher profile: criar/atualizar/desativar conforme role ---
        // role final (após update)
        const finalRole = (data.role ?? previousRole) as string | undefined;

        // valores finais pra sincronizar no teacher
        const finalName = (data.name ?? existingProfile.name) as string | undefined;
        const finalEmail = (data.email ?? existingProfile.email) as string | undefined;
        const finalPhone = (data.phone ?? existingProfile.phone) as string | undefined;
        const finalIsActive =
            typeof data.isActive === 'boolean' ? data.isActive : (existingProfile.isActive as boolean | undefined);

        const teacherRef = admin.firestore().collection('teachers').doc(userId);

        if (finalRole === 'teacher') {
            // Teacher exige email/phone/name
            if (!finalName || !finalEmail || !finalPhone) {
                return res.status(400).send({
                    error: 'Para manter/criar um professor, name/email/phone precisam estar preenchidos.',
                });
            }

            const teacherSnap = await teacherRef.get();

            if (!teacherSnap.exists) {
                // criar teacher profile com contador próprio
                const teacherCounterRef = admin.firestore().collection('counters').doc('teacherProfiles');

                const newTeacherPublicId = await admin.firestore().runTransaction<number>(async (transaction) => {
                    const counterDoc = await transaction.get(teacherCounterRef);
                    if (!counterDoc.exists) {
                        const nextId = 1;
                        transaction.set(teacherCounterRef, { lastId: nextId });
                        return nextId;
                    } else {
                        const lastId = counterDoc.data()?.lastId || 0;
                        const nextId = lastId + 1;
                        transaction.update(teacherCounterRef, { lastId: nextId });
                        return nextId;
                    }
                });

                await teacherRef.set({
                    id: userId,
                    publicId: newTeacherPublicId,
                    name: finalName,
                    email: finalEmail,
                    phone: finalPhone,
                    authUid: userId,
                    isActive: typeof finalIsActive === 'boolean' ? finalIsActive : true,

                    createdBy: adminUid,
                    updatedBy: adminUid,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                // atualizar teacher profile
                await teacherRef.update({
                    name: finalName,
                    email: finalEmail,
                    phone: finalPhone,
                    authUid: userId,
                    // Mantém sincronizado com userProfiles, se vier
                    ...(typeof finalIsActive === 'boolean' ? { isActive: finalIsActive } : {}),

                    updatedBy: adminUid,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        } else if (previousRole === 'teacher' && finalRole !== 'teacher') {
            // saiu de teacher -> desativar (não deletar)
            const teacherSnap = await teacherRef.get();
            if (teacherSnap.exists) {
                await teacherRef.update({
                    isActive: false,
                    updatedBy: adminUid,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }

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


// export const deleteUser = async (req: Request, res: Response) => {
//     try {
//         const { userId } = req.params;
//         const adminUid = req.user?.uid;

//         if (!adminUid) {
//             return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
//         }

//         // --- 1. Deletar do Firebase Auth ---
//         await admin.auth().deleteUser(userId);

//         // --- 2. Deletar do Firestore ---
//         const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
//         await userProfileRef.delete();

//         // TODO: Implementar a lógica de log, se necessário.
//         // A função antiga criava um log. Podemos replicar isso aqui.
//         // await admin.firestore().collection('logs').add({ ... });

//         console.log(`Usuário (UID: ${userId}) deletado com sucesso pelo admin (UID: ${adminUid}).`);
//         return res.status(200).send({ message: 'Usuário deletado com sucesso.' });

//     } catch (error: any) {
//         console.error(`Erro ao deletar usuário ${req.params.userId}:`, error);
//         if (error.code === 'auth/user-not-found') {
//             // Se o usuário não existe no Auth, talvez ainda exista no Firestore.
//             // Tentamos deletar do Firestore mesmo assim.
//             try {
//                 await admin.firestore().collection('userProfiles').doc(req.params.userId).delete();
//                 return res.status(200).send({ message: 'Usuário não encontrado no Auth, mas perfil do Firestore foi removido.' });
//             } catch (dbError) {
//                 console.error('Erro ao deletar perfil do Firestore:', dbError);
//                 return res.status(404).send({ error: 'Usuário não encontrado no Auth nem no Firestore.' });
//             }
//         }
//         return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
//     }
// };

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const adminUid = req.user?.uid;

        if (!adminUid) {
            return res.status(403).send({ error: 'ID do administrador não encontrado na autenticação.' });
        }

        // --- 0. Buscar perfil para saber role ---
        const userProfileRef = admin.firestore().collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
            return res.status(404).send({ error: 'Perfil do usuário não encontrado no Firestore.' });
        }

        const userProfile = userProfileSnap.data() as any;
        const role = userProfile?.role;

        // --- 0.1 Se for teacher, verificar dependências (turmas) ---
        if (role === 'teacher') {
            const classesSnap = await admin
                .firestore()
                .collection('classes')
                .where('teacherId', '==', userId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!classesSnap.empty) {
                return res.status(409).send({
                    error: 'Não é possível deletar este professor, pois ele possui turmas ativas associadas.',
                });
            }
        }

        // --- 1. Deletar do Firebase Auth ---
        await admin.auth().deleteUser(userId);

        // --- 2. Deletar do Firestore ---
        await userProfileRef.delete();

        console.log(`Usuário (UID: ${userId}) deletado com sucesso pelo admin (UID: ${adminUid}).`);
        return res.status(200).send({ message: 'Usuário deletado com sucesso.' });

    } catch (error: any) {
        console.error(`Erro ao deletar usuário ${req.params.userId}:`, error);

        if (error.code === 'auth/user-not-found') {
            // Se não existe no Auth, tenta remover perfil
            try {
                await admin.firestore().collection('userProfiles').doc(req.params.userId).delete();
                return res.status(200).send({
                    message: 'Usuário não encontrado no Auth, mas perfil do Firestore foi removido.',
                });
            } catch (dbError) {
                console.error('Erro ao deletar perfil do Firestore:', dbError);
                return res.status(404).send({ error: 'Usuário não encontrado no Auth nem no Firestore.' });
            }
        }

        return res.status(500).send({ error: 'Ocorreu um erro interno no servidor.' });
    }
};


export const clearPasswordClaim = async (req: Request, res: Response) => {
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
export const getContractFile = async (req: Request, res: Response) => {
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

        if (!studentData.contractUrl) {
            return res.status(404).send({ error: 'Este aluno não possui um contrato salvo.' });
        }

        // --- Download do Arquivo do Supabase ---
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('contracts')
            .download(studentData.contractUrl);

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