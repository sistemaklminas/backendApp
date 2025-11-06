/* eslint-disable @typescript-eslint/no-explicit-any */
// Em: backend/src/controllers/syncController.ts

import * as admin from 'firebase-admin';

// Interface para os dados do documento 'Teacher'
interface TeacherData {
    id: string;
    name: string;
    email?: string; // Email é opcional no professor
    phone: string;
    authUid?: string; // O UID do UserProfile, se já existir
    isActive: boolean;
}

/**
 * Sincroniza um documento 'Teacher' com um 'UserProfile'.
 * Cria ou atualiza o UserProfile correspondente.
 * @param teacherId O ID do documento do professor.
 * @param teacherData Os dados do documento do professor.
 */
export const syncTeacherWithUserProfile = async (teacherId: string, teacherData: TeacherData) => {
    const { email, name, phone, authUid } = teacherData;

    // --- CENÁRIO 1: Professor NÃO tem email ---
    // Se não há email, não há nada para sincronizar com o Firebase Auth.
    if (!email) {
        console.log(`Professor ${name} (ID: ${teacherId}) não possui email. Sincronização ignorada.`);
        // Se ele tinha um UserProfile antes e o email foi removido, podemos desativar o UserProfile.
        if (authUid) {
            try {
                await admin.auth().updateUser(authUid, { disabled: true });
                await admin.firestore().collection('userProfiles').doc(authUid).update({ isActive: false });
                console.log(`Antigo UserProfile (UID: ${authUid}) desativado.`);
            } catch (error) {
                console.error(`Erro ao desativar antigo UserProfile ${authUid}:`, error);
            }
        }
        return;
    }

    try {
        // --- CENÁRIO 2: Professor JÁ TEM um UserProfile vinculado (authUid existe) ---
        if (authUid) {
            console.log(`Sincronizando professor existente. TeacherID: ${teacherId}, AuthUID: ${authUid}`);
            // Atualiza o Firebase Auth
            await admin.auth().updateUser(authUid, {
                email: email,
                displayName: name,
                phoneNumber: phone,
                disabled: !teacherData.isActive, // Desativa no Auth se o professor estiver inativo
            });
            // Atualiza o Firestore UserProfile
            await admin.firestore().collection('userProfiles').doc(authUid).update({
                name: name,
                email: email,
                phone: phone,
                isActive: teacherData.isActive,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`UserProfile (UID: ${authUid}) atualizado com sucesso.`);
            return;
        }

        // --- CENÁRIO 3: CRIAÇÃO DE NOVO UserProfile PARA O PROFESSOR ---
        console.log(`Criando novo UserProfile para o professor ${name} (Email: ${email})`);

        // --- LÓGICA DE SENHA PADRÃO E CUSTOM CLAIM (APENAS AQUI) ---
        const defaultPassword = 'kl2026_123456';
        const userRecord = await admin.auth().createUser({
            email: email,
            password: defaultPassword, // <<< SENHA PADRÃO
            displayName: name,
            phoneNumber: phone,
        });
        const newAuthUid = userRecord.uid;
        await admin.auth().setCustomUserClaims(newAuthUid, { mustChangePassword: true }); // <<< ETIQUETA
        console.log(`Novo usuário criado no Auth (UID: ${newAuthUid}) com claim de mudança de senha.`);

        // --- LÓGICA DO publicId PARA 'userProfiles' ---
        const counterRef = admin.firestore().collection('counters').doc('userProfiles');
        const newPublicId = await admin.firestore().runTransaction(async (transaction) => {
            let nextId = 1;
            const counterDoc = await transaction.get(counterRef);
            nextId = (counterDoc.data()?.currentId || 0) + 1;
            transaction.set(counterRef, { currentId: newPublicId }, { merge: true });
            return nextId
        });

        // --- Criar o perfil no Firestore ---
        const userProfileRef = admin.firestore().collection('userProfiles').doc(newAuthUid);
        await userProfileRef.set({
            id: newAuthUid,
            publicId: newPublicId,
            name,
            email,
            phone,
            role: 'teacher',
            isActive: teacherData.isActive,
            createdBy: 'system_sync',
            updatedBy: 'system_sync',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            document: null,
            photoUrl: null,
        });

        // Vincula o novo authUid de volta ao documento do professor
        await admin.firestore().collection('teachers').doc(teacherId).update({ authUid: newAuthUid });

        console.log(`Sincronização concluída. Teacher ${teacherId} vinculado ao UID ${newAuthUid}.`);


    } catch (error: any) {
        // Se o erro for 'email-already-exists', significa que já existe um usuário com esse email
        // mas ele não está vinculado a este professor. Isso é um conflito que precisa ser resolvido manualmente.
        if (error.code === 'auth/email-already-exists') {
            console.error(`ERRO DE SINCRONIZAÇÃO: O email ${email} já está em uso por outro usuário no Firebase Auth, mas não está vinculado ao professor ${teacherId}. Ação manual necessária.`);
        } else {
            console.error(`Erro inesperado ao sincronizar professor ${teacherId}:`, error);
        }
    }
};
