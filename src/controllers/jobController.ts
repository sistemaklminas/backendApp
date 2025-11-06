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

        if (snapshot.empty) {
            console.log('Nenhum aluno com contrato vencido encontrado.');
            return res.status(200).send({ message: 'Nenhum aluno com contrato vencido encontrado.' });
        }

        // --- Desativação em Lote (Batch) ---
        const batch = admin.firestore().batch();
        const deactivatedStudents: { id: string; name: string }[] = [];

        snapshot.forEach(doc => {
            const studentData = doc.data();
            console.log(`Agendando desativação para o aluno ${doc.id} (${studentData.name}) por contrato vencido.`);

            batch.update(doc.ref, {
                isActive: false,
                updatedBy: 'system_cron_contract', // Identificador claro da origem da mudança
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // Opcional: Adicionar uma nota explicando a desativação
            });

            deactivatedStudents.push({ id: doc.id, name: studentData.name });
        });

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
