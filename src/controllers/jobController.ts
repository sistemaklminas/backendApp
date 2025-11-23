// Em: backend/src/controllers/jobController.ts

import { type Request, type Response } from 'express';
import * as admin from 'firebase-admin';

/**
 * Busca e desativa alunos com contratos pendentes e vencidos.
 * Esta função é projetada para ser chamada por um cron job.
 */
export const checkPendingContractsJob = async (req: Request, res: Response) => {
    console.log('Job de verificação de contratos pendentes iniciado...');

    try {
        // --- Lógica para buscar a constante do Firestore ---
        const constantsDoc = await admin.firestore().collection('systemConstants').doc('single').get();
        const deadlineDays = constantsDoc.data()?.contractDeadlineDays || 7; // Usa 7 dias como padrão

        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() - deadlineDays);

        // --- Query para encontrar os alunos "vencidos" ---
        const studentsRef = admin.firestore().collection('students');
        const q = studentsRef
            .where('isActive', '==', true)
            .where('contractSigned', '==', false)
            .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(deadlineDate));

        const snapshot = await q.get();

        // if (snapshot.empty) {
        //     console.log('Nenhum aluno com contrato vencido encontrado.');
        //     return res.status(200).send({ message: 'Nenhum aluno com contrato vencido encontrado.' });
        // }

        // // --- Desativação em Lote (Batch) ---
        // const batch = admin.firestore().batch();
        // const deactivatedStudents: { id: string; name: string }[] = [];

        // snapshot.forEach(doc => {
        //     const studentData = doc.data();
        //     console.log(`Agendando desativação para o aluno ${doc.id} (${studentData.name}) por contrato vencido.`);

        //     batch.update(doc.ref, {
        //         isActive: false,
        //         updatedBy: 'system_cron_contract', // Identificador claro da origem da mudança
        //         updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        //         // Opcional: Adicionar uma nota explicando a desativação
        //     });

        //     deactivatedStudents.push({ id: doc.id, name: studentData.name });
        // });

        // 1. Busca todas as inscrições "reais" e ativas
        const realSubscriptionsQuery = admin.firestore().collection('subscriptions')
            .where('isActive', '==', true)
            .where('isWaiting', '==', false)
            .where('isExperimental', '==', false);

        // 2. Executa as duas queries em paralelo
        const [pendingStudentsSnap, realSubscriptionsSnap] = await Promise.all([
            q.get(),
            realSubscriptionsQuery.get(),
        ]);

        if (pendingStudentsSnap.empty) {
            console.log('Nenhum aluno com contrato vencido encontrado.');
            return res.status(200).send({ message: 'Nenhum aluno com contrato vencido encontrado.' });
        }

        // 3. Cria um Set com os IDs dos alunos que têm inscrições reais
        const studentsWithRealSubs = new Set<string>();
        realSubscriptionsSnap.forEach(doc => {
            studentsWithRealSubs.add(doc.data().studentId);
        });

        // --- Desativação em Lote (Batch) Apenas para Alunos Válidos ---
        const batch = admin.firestore().batch();
        const deactivatedStudents: { id: string; name: string }[] = [];

        pendingStudentsSnap.forEach(doc => {
            // Desativa o aluno SOMENTE se o ID dele estiver no Set de alunos com inscrições reais
            if (studentsWithRealSubs.has(doc.id)) {
                const studentData = doc.data();
                console.log(`Agendando desativação para o aluno ${doc.id} (${studentData.name.toLocaleUpperCase()}) por contrato vencido e matrícula real.`);

                batch.update(doc.ref, {
                    isActive: false,
                    updatedBy: 'system_cron_contract',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                deactivatedStudents.push({ id: doc.id, name: studentData.name });
            }
        });

        // Se nenhum aluno correspondeu aos critérios, não há nada a fazer.
        if (deactivatedStudents.length === 0) {
            console.log('Nenhum aluno com contrato vencido E matrícula real foi encontrado para desativação.');
            return res.status(200).send({ message: 'Nenhum aluno elegível para desativação.' });
        }

        await batch.commit();

        const successMessage = `${snapshot.size} aluno(s) desativado(s) com sucesso.`;
        console.log(successMessage, deactivatedStudents);

        return res.status(200).send({
            message: successMessage,
            deactivatedStudents,
        });

    } catch (error) {
        console.error('Erro durante a execução do job de verificação de contratos:', error);
        return res.status(500).send({ error: 'Erro interno ao processar o job.' });
    }
};
