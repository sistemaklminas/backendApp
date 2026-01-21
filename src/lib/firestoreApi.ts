// Em: src/lib/firestoreApi.ts

import {
    Contract,
    Student,
    FinancialResponsible,
    StudentSubscription,
    Course,
    Enrollment,
    ContractSessionData
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

    const studentIds = contract.studentIds;
    const studentsQuery = await db.collection('students').where(admin.firestore.FieldPath.documentId(), 'in', studentIds).get();
    const studentsMap = new Map(studentsQuery.docs.map(d => [d.id, d.data() as Student]));

    const subscriptionsQuery = await db.collection('subscriptions')
        .where('studentId', 'in', studentIds)
        .where('year', '==', contract.year)
        .where('isActive', '==', true)
        .get();
    const allSubscriptions = subscriptionsQuery.docs.map(d => d.data() as StudentSubscription);

    const courseIds = [...new Set(allSubscriptions.map(sub => sub.courseId))];
    const coursesQuery = await db.collection('courses').where(admin.firestore.FieldPath.documentId(), 'in', courseIds).get();
    const coursesMap = new Map(coursesQuery.docs.map(d => [d.id, d.data() as Course]));

    let totalFullPrice = 0;
    let totalAppliedPrice = 0;
    const subscriptionItems: ContractSessionData['subscriptionItems'] = [];

    for (const sub of allSubscriptions) {
        totalFullPrice += sub.fullPrice;
        totalAppliedPrice += sub.finalPrice;

        const student = studentsMap.get(sub.studentId);
        const course = coursesMap.get(sub.courseId);

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

    const enrollmentPromises = studentIds.map(id => db.collection('students').doc(id).collection('enrollments').doc(String(contract.year)).get());
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

// Exportando formatCurrency para ser usado no PDF
export { formatCurrency };
