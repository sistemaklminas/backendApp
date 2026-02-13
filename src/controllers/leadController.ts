import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const leadsCollection = admin.firestore().collection('landingLeads');

const allowedStatuses = ['new', 'in_progress', 'closed'] as const;
type LeadStatus = (typeof allowedStatuses)[number];

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function serializeTimestamp(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  return null;
}

export const createLandingLead = async (req: Request, res: Response) => {
  const { name, email, phone, message } = req.body ?? {};

  if (!name || !email || !phone || !message) {
    return res.status(400).json({
      error: 'name, email, phone e message são obrigatórios.',
    });
  }

  const payload = {
    name: String(name).trim(),
    email: normalizeEmail(email),
    phone: normalizePhone(phone),
    message: String(message).trim(),
    status: 'new' as LeadStatus,
    source: 'landing-page',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'public-form',
    updatedBy: 'public-form',
    metadata: {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    },
  };

  try {
    const docRef = await leadsCollection.add(payload);
    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: 'Lead recebido com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao criar lead da landing:', error);
    return res.status(500).json({
      error: 'Falha ao enviar contato. Tente novamente.',
    });
  }
};

export const listLandingLeads = async (req: Request, res: Response) => {
  const statusFilter = String(req.query.status || '').trim();
  const limitQuery = Number(req.query.limit || 200);
  const limit = Number.isFinite(limitQuery)
    ? Math.max(1, Math.min(500, limitQuery))
    : 200;

  try {
    const snapshot = await leadsCollection
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    let leads = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        name: String(data.name || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        message: String(data.message || ''),
        status: String(data.status || 'new'),
        source: String(data.source || 'landing-page'),
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        handledBy: data.handledBy ? String(data.handledBy) : null,
      };
    });

    if (statusFilter && allowedStatuses.includes(statusFilter as LeadStatus)) {
      leads = leads.filter((lead) => lead.status === statusFilter);
    }

    return res.status(200).json({
      success: true,
      leads,
    });
  } catch (error) {
    console.error('Erro ao listar leads da landing:', error);
    return res.status(500).json({ error: 'Falha ao listar leads.' });
  }
};

export const updateLandingLeadStatus = async (req: Request, res: Response) => {
  const { leadId } = req.params;
  const { status } = req.body ?? {};
  const actorUid = req.user?.uid || 'unknown';

  if (!leadId) {
    return res.status(400).json({ error: 'leadId é obrigatório.' });
  }

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      error: `status inválido. Use: ${allowedStatuses.join(', ')}`,
    });
  }

  try {
    const docRef = leadsCollection.doc(leadId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Lead não encontrado.' });
    }

    await docRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid,
      handledBy: actorUid,
    });

    return res.status(200).json({
      success: true,
      message: 'Status atualizado com sucesso.',
    });
  } catch (error) {
    console.error('Erro ao atualizar status do lead:', error);
    return res.status(500).json({ error: 'Falha ao atualizar lead.' });
  }
};

