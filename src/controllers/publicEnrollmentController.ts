import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import crypto from 'node:crypto';

const db = admin.firestore();

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

async function getOrCreateUser(email: string, name: string, document?: string) {
  let authUser: admin.auth.UserRecord;
  try {
    authUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    authUser = await admin.auth().createUser({
      email,
      password: crypto.randomBytes(24).toString('base64url'),
      displayName: name,
      emailVerified: false,
    });
  }

  const profileRef = db.collection('userProfiles').doc(authUser.uid);
  const profileSnap = await profileRef.get();
  await profileRef.set({
    name,
    email,
    document: document || null,
    ...(profileSnap.exists ? {} : { role: 'user', isActive: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: 'public-enrollment' }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'public-enrollment',
  }, { merge: true });

  return authUser.uid;
}

export const provisionPublicEnrollmentUsers = async (req: Request, res: Response) => {
  const { studentId } = req.body ?? {};
  if (!studentId || typeof studentId !== 'string') {
    return res.status(400).json({ error: 'studentId é obrigatório.' });
  }

  try {
    const studentSnap = await db.collection('students').doc(studentId).get();
    if (!studentSnap.exists) return res.status(404).json({ error: 'Aluno não encontrado.' });
    const student = studentSnap.data()!;

    const responsibleSnap = await db.collection('financialResponsibles').doc(student.financialResponsibleId).get();
    if (!responsibleSnap.exists) return res.status(422).json({ error: 'Responsável financeiro não encontrado.' });
    const responsible = responsibleSnap.data()!;

    const parentIds = [student.parentOneId, student.parentTwoId].filter(Boolean) as string[];
    const parentSnaps = await Promise.all(parentIds.map((id) => db.collection('parents').doc(id).get()));
    const people = [
      { email: normalizeEmail(responsible.email), name: String(responsible.name || ''), document: responsible.document, collection: 'financialResponsibles', id: student.financialResponsibleId },
      ...parentSnaps.filter((snap) => snap.exists).map((snap) => {
        const data = snap.data()!;
        return { email: normalizeEmail(data.email), name: String(data.name || ''), document: undefined, collection: 'parents', id: snap.id };
      }),
    ].filter((person) => person.email);

    const peopleByEmail = new Map<string, typeof people>();
    for (const person of people) {
      const group = peopleByEmail.get(person.email) || [];
      group.push(person);
      peopleByEmail.set(person.email, group);
    }
    const accounts = [];
    for (const [email, group] of peopleByEmail) {
      const person = group[0];
      const uid = await getOrCreateUser(email, person.name, person.document);
      for (const linkedPerson of group) {
        await db.collection(linkedPerson.collection).doc(linkedPerson.id).set({
          authUid: uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: 'public-enrollment',
        }, { merge: true });
      }
      accounts.push({ email, uid });
    }

    return res.status(200).json({ success: true, studentId, accounts });
  } catch (error) {
    console.error('Erro ao provisionar acessos da matrícula pública:', error);
    return res.status(500).json({ error: 'Falha ao criar os acessos.' });
  }
};
