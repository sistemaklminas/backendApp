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

export const processWaitlistExpirationsJob = async (_req: Request, res: Response) => {
    const firestore = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    try {
        const constantsSnap = await firestore.collection('systemConstants').doc('main').get();
        const constants = constantsSnap.exists
            ? constantsSnap.data()
            : (await firestore.collection('systemConstants').doc('single').get()).data();
        const reservationDays = Number(constants?.waitlistReservationDays || 2);
        const expired = await firestore.collection('subscriptions')
            .where('isActive', '==', true)
            .where('isWaiting', '==', true)
            .where('waitlistOfferExpiresAt', '<=', now)
            .get();
        let processed = 0;
        for (const expiredDoc of expired.docs) {
            const sub = expiredDoc.data();
            const queue = await firestore.collection('subscriptions')
                .where('classId', '==', sub.classId)
                .where('year', '==', sub.year)
                .where('isActive', '==', true)
                .where('isWaiting', '==', true)
                .orderBy('subscriptionDate', 'desc')
                .limit(1).get();
            const last = queue.empty ? now : queue.docs[0].data().subscriptionDate;
            const nextMillis = Math.max(now.toMillis(), last?.toMillis?.() + 1 || now.toMillis());
            const nextDate = admin.firestore.Timestamp.fromMillis(nextMillis);
            const batch = firestore.batch();
            batch.update(expiredDoc.ref, {
                subscriptionDate: nextDate,
                waitlistOfferStartedAt: null,
                waitlistOfferExpiresAt: null,
                waitlistLastActionAt: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'system_waitlist_job',
            });
            batch.set(firestore.collection('auditLogs').doc(), {
                author: { id: 'system_waitlist_job', name: 'Processador automático da fila', role: 'system' },
                action: 'WAITLIST_OFFER_EXPIRED',
                target: { type: 'subscription', id: expiredDoc.id, name: String(sub.studentId) },
                details: { classId: sub.classId, year: sub.year, reservationDays, movedToEndAt: nextDate },
                createdAt: now,
            });
            await batch.commit();
            processed++;
        }
        let offered = 0;
        const classes = await firestore.collection('classes').where('isActive', '==', true).get();
        for (const classDoc of classes.docs) {
            const classData = classDoc.data();
            const year = Number(classData.year || constants?.currentSchoolYear || new Date().getFullYear());
            const enrolled = await firestore.collection('subscriptions')
                .where('classId', '==', classDoc.id).where('year', '==', year)
                .where('isActive', '==', true).where('isWaiting', '==', false)
                .get();
            const capacity = Number(classData.maxStudents || classData.vacancies || 0);
            if (!capacity || enrolled.size >= capacity) continue;
            const waiting = await firestore.collection('subscriptions')
                .where('classId', '==', classDoc.id).where('year', '==', year)
                .where('isActive', '==', true).where('isWaiting', '==', true)
                .orderBy('subscriptionDate', 'asc').limit(1).get();
            if (waiting.empty) continue;
            const waitingDoc = waiting.docs[0];
            const waitingData = waitingDoc.data();
            if (waitingData.waitlistOfferExpiresAt?.toMillis?.() > now.toMillis()) continue;
            const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + reservationDays * 24 * 60 * 60 * 1000);
            const batch = firestore.batch();
            batch.update(waitingDoc.ref, { waitlistOfferStartedAt: now, waitlistOfferExpiresAt: expiresAt, waitlistLastActionAt: now, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: 'system_waitlist_job' });
            batch.set(firestore.collection('auditLogs').doc(), { author: { id: 'system_waitlist_job', name: 'Processador automático da fila', role: 'system' }, action: 'WAITLIST_OFFER_CREATED', target: { type: 'subscription', id: waitingDoc.id, name: String(waitingData.studentId) }, details: { classId: classDoc.id, year, expiresAt, reservationDays }, createdAt: now });
            await batch.commit();
            offered++;
        }
        return res.status(200).json({ processed, offered, processedAt: now.toDate().toISOString() });
    } catch (error) {
        console.error('Erro ao processar expirações da fila:', error);
        return res.status(500).json({ error: 'Erro interno ao processar a fila.' });
    }
};
