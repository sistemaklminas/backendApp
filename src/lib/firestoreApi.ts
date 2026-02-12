// Em: src/lib/firestoreApi.ts

import {
    Contract,
    Student,
    FinancialResponsible,
    StudentSubscription,
    Course,
    Enrollment,
    ContractSessionData,
    ContractAddendum,
    AddendumSessionData
} from '../types';
import { admin, db } from './firebaseAdmin';

// Função helper para formatar data
const toLocaleDateString = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// Função helper para formatar moeda
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export async function getContractSessionData(contractId: string): Promise<ContractSessionData> {
    const contractSnap = await db.collection('contracts').doc(contractId).get();
    if (!contractSnap.exists) throw new Error('Contrato não encontrado.');
    const contract = contractSnap.data() as Contract;

    const responsibleSnap = await db.collection('financialResponsibles').doc(contract.financialResponsibleId).get();
    if (!responsibleSnap.exists) throw new Error('Responsável financeiro não encontrado.');
    const financialResponsible = responsibleSnap.data() as FinancialResponsible;

    const validContractStudentIds = (contract.studentIds || [])
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

    if (validContractStudentIds.length === 0) {
        throw new Error('Contrato sem alunos válidos para gerar documento.');
    }

    const subscriptionsQuery = await db.collection('subscriptions')
        .where('studentId', 'in', validContractStudentIds)
        .where('year', '==', contract.year)
        .where('isActive', '==', true)
        .get();
    let allSubscriptions = subscriptionsQuery.docs.map(d => d.data() as StudentSubscription);

    if (allSubscriptions.length === 0) {
        throw new Error('Nenhuma inscrição ativa encontrada para gerar o contrato.');
    }

    const subscriptionStudentIds = [...new Set(
        allSubscriptions
            .map(sub => sub.studentId)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    )];

    if (subscriptionStudentIds.length === 0) {
        throw new Error('Nenhum aluno válido encontrado nas inscrições para gerar o contrato.');
    }
    const studentsQuery = await db.collection('students')
        .where(admin.firestore.FieldPath.documentId(), 'in', subscriptionStudentIds)
        .get();
    const studentsMap = new Map(studentsQuery.docs.map(d => [d.id, d.data() as Student]));
    const validStudentIds = new Set(
        studentsQuery.docs
            .filter(docSnap => {
                const data = docSnap.data() as Student;
                return Array.isArray(data.activeYears) && data.activeYears.includes(contract.year);
            })
            .map(docSnap => docSnap.id)
    );

    allSubscriptions = allSubscriptions.filter(sub => validStudentIds.has(sub.studentId));

    if (allSubscriptions.length === 0) {
        throw new Error('Nenhuma inscrição ativa encontrada para gerar o contrato.');
    }

    const classIds = [...new Set(
        allSubscriptions
            .map(sub => sub.classId)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    )];
    if (classIds.length === 0) {
        throw new Error('Nenhuma turma válida encontrada para gerar o contrato.');
    }

    const classesQuery = await db.collection('classes')
        .where(admin.firestore.FieldPath.documentId(), 'in', classIds)
        .get();
    const classesMap = new Map(classesQuery.docs.map(d => [d.id, d.data() as { courseId?: string }]));

    const courseIds = [...new Set(
        Array.from(classesMap.values())
            .map(cls => cls?.courseId)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    )];
    if (courseIds.length === 0) {
        throw new Error('Nenhum curso válido encontrado para gerar o contrato.');
    }
    const coursesQuery = await db.collection('courses').where(admin.firestore.FieldPath.documentId(), 'in', courseIds).get();
    const coursesMap = new Map(coursesQuery.docs.map(d => [d.id, d.data() as Course]));

    let totalFullPrice = 0;
    let totalAppliedPrice = 0;
    const subscriptionItems: ContractSessionData['subscriptionItems'] = [];

    for (const sub of allSubscriptions) {
        totalFullPrice += sub.fullPrice;
        totalAppliedPrice += sub.finalPrice;

        const student = studentsMap.get(sub.studentId);
        const courseIdFromClass = classesMap.get(sub.classId)?.courseId;
        const courseId = sub.courseId || courseIdFromClass;
        const course = courseId ? coursesMap.get(courseId) : null;

        let discountReason = '-';
        if (sub.discounts.hasFamilyDiscount) discountReason = 'Desconto Familiar';
        else if (sub.discounts.hasSecondCourseDiscount) discountReason = '2º Curso';
        else if (sub.discounts.hasEmployeeDiscount) discountReason = 'Funcionário';
        else if (sub.discounts.customDiscountPercentage > 0) discountReason = `Personalizado (${sub.discounts.customDiscountPercentage}%)`;
        if (sub.fullPrice === sub.finalPrice) discountReason = '-';

        subscriptionItems.push({
            studentName: student?.name ?? 'N/A',
            courseName: course?.name ?? 'N/A',
            startDate: sub.startDate ? toLocaleDateString(sub.startDate.toDate()) : 'N/A',
            endDate: `31/12/${contract.year}`,
            fullPrice: sub.fullPrice,
            appliedPrice: sub.finalPrice,
            discountReason: discountReason,
        });
    }

    const enrollmentPromises = [...new Set(allSubscriptions.map(sub => sub.studentId))]
        .map(id => db.collection('students').doc(id).collection('enrollments').doc(String(contract.year)).get());
    const enrollmentDocs = await Promise.all(enrollmentPromises);
    const totalEnrollmentFee = enrollmentDocs.reduce((sum, doc) => {
        if (doc.exists) {
            const enrollment = doc.data() as Enrollment;
            if (!enrollment.isExempt) {
                return sum + enrollment.totalValue;
            }
        }
        return sum;
    }, 0);

    return {
        year: contract.year,
        status: contract.status,
        financialResponsible,
        subscriptionItems,
        enrollmentFee: totalEnrollmentFee,
        totalFullPrice,
        totalAppliedPrice,
    };
}

export async function getAddendumSessionData(addendumId: string): Promise<AddendumSessionData> {
    const addendumSnap = await db.collection('contractAddendums').doc(addendumId).get();
    if (!addendumSnap.exists) throw new Error('Aditivo não encontrado.');
    const addendum = addendumSnap.data() as ContractAddendum;

    const responsibleSnap = await db.collection('financialResponsibles').doc(addendum.financialResponsibleId).get();
    if (!responsibleSnap.exists) throw new Error('Responsável financeiro não encontrado.');
    const financialResponsible = responsibleSnap.data() as FinancialResponsible;

    const afterSnapshot = (addendum.snapshot?.after || {}) as Record<string, any>;
    const subscriptionItems = (afterSnapshot.subscriptionItems || []) as AddendumSessionData['subscriptionItems'];
    const totalFullPrice = Number(afterSnapshot.totalFullPrice || 0);
    const totalAppliedPrice = Number(afterSnapshot.totalAppliedPrice || 0);
    const enrollmentFeeUpdated = Number(addendum.snapshot?.enrollmentFeeUpdated ?? afterSnapshot.enrollmentFee ?? 0);
    const enrollmentFeeOriginal = Number(addendum.snapshot?.enrollmentFeeOriginal ?? (addendum.snapshot?.before as any)?.enrollmentFee ?? 0);
    const enrollmentFeeDifference = Number(
        addendum.snapshot?.enrollmentFeeDifference ?? Math.max(0, enrollmentFeeUpdated - enrollmentFeeOriginal)
    );

    return {
        addendumId,
        contractId: addendum.contractId,
        year: addendum.year,
        financialResponsible,
        reason: addendum.reason,
        subscriptionItems,
        enrollmentFeeOriginal,
        enrollmentFeeUpdated,
        enrollmentFeeDifference,
        totalFullPrice,
        totalAppliedPrice,
        generatedAt: addendum.generatedAt,
    };
}

/**
 * Encontra o contrato de um aluno para um determinado ano e retorna seu status.
 * @param studentId O ID do aluno.
 * @param year O ano letivo a ser verificado.
 * @returns O status do contrato ('pending', 'sent_to_signature', 'signed') ou null se nenhum contrato for encontrado.
 */
export async function getStudentContractStatus(
    studentId: string,
    year: number,
): Promise<Contract['status'] | null> {
    if (!studentId || !year) {
        return null;
    }

    // A forma mais eficiente de encontrar o contrato de um aluno é usar uma query 'array-contains'.
    // Isso exige que o campo 'studentIds' seja um array no seu documento de contrato.
    const contractsQuery = db
        .collection('contracts')
        .where('year', '==', year)
        .where('studentIds', 'array-contains', studentId)
        .limit(1); // Um aluno só deve pertencer a um contrato por ano.

    const snapshot = await contractsQuery.get();

    if (snapshot.empty) {
        console.warn(`Nenhum contrato encontrado para o aluno ${studentId} no ano ${year}.`);
        return null; // Retorna null se nenhum contrato for encontrado
    }

    const contract = snapshot.docs[0].data() as Contract;
    return contract.status;
}

// Exportando formatCurrency para ser usado no PDF
export { formatCurrency };
