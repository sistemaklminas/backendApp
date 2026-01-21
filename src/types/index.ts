// Em: src/types.ts

import { Timestamp } from 'firebase-admin/firestore';

// --- TIPOS DE DADOS PRINCIPAIS ---

export interface FinancialResponsible {
    id: string;
    name: string;
    email: string;
    phone: string;
    document: string;
    address: {
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
    };
}

export interface Student {
    id: string;
    name: string;
    financialResponsibleId: string;
    // Adicione outros campos de Student se precisar
}

export interface Course {
    id: string;
    name: string;
}

export interface StudentSubscription {
    id: string;
    studentId: string;
    classId: string;
    courseId: string; // Assumindo que você tem isso na inscrição
    year: number;
    isActive: boolean;
    fullPrice: number;
    finalPrice: number;
    startDate?: Timestamp;
    discounts: {
        hasFamilyDiscount: boolean;
        hasSecondCourseDiscount: boolean;
        hasEmployeeDiscount: boolean;
        customDiscountPercentage: number;
    };
}

export interface Enrollment {
    isExempt: boolean;
    totalValue: number;
}

export interface Contract {
    id: string;
    studentIds: string[];
    financialResponsibleId: string;
    year: number;
    status: 'pending' | 'sent_to_signature' | 'signed';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    signedAt: Timestamp | null;
    zapSignToken?: string;
}


// --- TIPO DE DADOS PARA O TEMPLATE DO CONTRATO ---

export interface ContractSessionData {
    year: number,
    status: 'pending' | 'sent_to_signature' | 'signed';
    financialResponsible: FinancialResponsible;
    subscriptionItems: Array<{
        studentName: string;
        courseName: string;
        startDate: string;
        endDate: string;
        fullPrice: number;
        appliedPrice: number;
        discountReason: string;
    }>;
    enrollmentFee: number;
    totalFullPrice: number;
    totalAppliedPrice: number;
}
