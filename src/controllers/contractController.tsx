/* eslint-disable @typescript-eslint/no-explicit-any */
// Em: src/controllers/contractController.tsx

import { Request, Response } from 'express';
import axios from 'axios';
// --- MUDANÇA NA IMPORTAÇÃO ---
import { renderToStream } from '@react-pdf/renderer';
import { ContractPDFDocument } from '../lib/pdf/ContractPDFDocument';
import { AddendumPDFDocument } from '../lib/pdf/AddendumPDFDocument';
import { getContractSessionData, getAddendumSessionData } from '../lib/firestoreApi';
import { db } from '../lib/firebaseAdmin';
import { Contract, ContractAddendum, ContractSessionData, AddendumSessionData } from '../types'; // <<< Importar o tipo

const ZAPSIGN_ENV = String(
  process.env.ZAPSIGN_ENV || process.env.ZAPSIGN_MODE || 'production'
).toLowerCase();
const ZAPSIGN_BASE_URL =
  process.env.ZAPSIGN_API_BASE_URL ||
  (ZAPSIGN_ENV === 'sandbox'
    ? 'https://sandbox.api.zapsign.com.br/api/v1'
    : 'https://api.zapsign.com.br/api/v1');
const ZAPSIGN_API_TOKEN =
  process.env.ZAPSIGN_API_TOKEN ||
  (ZAPSIGN_ENV === 'sandbox'
    ? process.env.ZAPSIGN_API_TOKEN_SANDBOX
    : process.env.ZAPSIGN_API_TOKEN_PRODUCTION) ||
  process.env.VITE_ZAPSIGN_API_TOKEN;

const getZapSignHeaders = () => {
  if (!ZAPSIGN_API_TOKEN) {
    throw new Error('ZAPSIGN_API_TOKEN não configurado no backend.');
  }
  return {
    Authorization: `Bearer ${ZAPSIGN_API_TOKEN}`,
  };
};

const normalizePhone = (value: string | undefined | null) =>
  String(value || '').replace(/\D/g, '');

const getUserProfileByUid = async (uid: string) => {
  const docSnap = await db.collection('userProfiles').doc(uid).get();
  return docSnap.exists ? docSnap.data() as { role?: string; document?: string } : null;
};

const canManageContractsByRole = (role?: string) =>
  role === 'root' || role === 'admin' || role === 'editor' || role === 'coordinator';

const canUserAccessResponsible = async (uid: string, financialResponsibleId: string): Promise<boolean> => {
  const profile = await getUserProfileByUid(uid);
  if (!profile) return false;
  if (canManageContractsByRole(profile.role)) return true;

  if (profile.role !== 'user') return false;
  const responsibleSnap = await db.collection('financialResponsibles').doc(financialResponsibleId).get();
  if (!responsibleSnap.exists) return false;
  const responsible = responsibleSnap.data() as { document?: string };
  const userDocument = String(profile.document || '').replace(/\D/g, '');
  const responsibleDocument = String(responsible.document || '').replace(/\D/g, '');
  return Boolean(userDocument && responsibleDocument && userDocument === responsibleDocument);
};

const getSignedFileUrlFromZapSign = async (docToken: string): Promise<string | null> => {
  const response = await axios.get(
    `${ZAPSIGN_BASE_URL}/docs/${docToken}`,
    { headers: getZapSignHeaders() }
  );
  return response.data?.signed_file || null;
};

// --- FUNÇÃO HELPER ATUALIZADA ---
// Agora usa renderToStream e o tipo correto para contractData
const generatePdfAsBase64 = async (
  contractData: ContractSessionData,
): Promise<string> => {
  // renderToStream é a forma correta de gerar o PDF no backend
  const stream = await renderToStream(
    <ContractPDFDocument data={contractData} />,
  );

  // 2. Consuma o stream. O tipo 'any' aqui é aceitável porque
  //    o stream retornado não tem um tipo Node.js padrão.
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('base64');
};

const generateAddendumPdfAsBase64 = async (
  addendumData: AddendumSessionData,
): Promise<string> => {
  const stream = await renderToStream(
    <AddendumPDFDocument data={addendumData} />,
  );

  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('base64');
};

export const sendContractForSignature = async (req: Request, res: Response) => {
  // O erro sobre 'req.user' é resolvido se não usarmos a variável.
  // Se precisássemos dela, faríamos: if (!req.user) { return res.status(401).json(...) }
  // const userId = req.user.uid; // <<< REMOVIDO, pois não era usado.

  const { contractId, initiator } = req.body;

  if (!contractId || !initiator) {
    return res
      .status(400)
      .json({ error: 'contractId e initiator são obrigatórios.' });
  }

  try {
    // --- PASSO 1: BUSCAR O CONTRATO E SEU STATUS ATUAL ---
    const contractRef = db.collection('contracts').doc(contractId);
    const contractDoc = await contractRef.get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contrato não encontrado.' });
    }
    const contract = contractDoc.data() as Contract; // 'Contract' tem o status e o zapSignToken

    // Se o contrato já está assinado, não há nada a fazer.
    if (contract.status === 'signed') {
      return res
        .status(400)
        .json({ error: 'Este contrato já foi finalizado.' });
    }

    // --- PASSO 2: A LÓGICA DE DIFERENCIAÇÃO ---

    // CASO A: O contrato nunca foi enviado ao ZapSign ('pending')
    if (contract.status === 'pending') {
      console.log(
        `Iniciando novo documento no ZapSign para o contrato ${contractId}...`,
      );

      const contractData = await getContractSessionData(contractId);
      const base64Pdf = await generatePdfAsBase64(contractData);

      const zapSignPayload = {
        external_id: contractId,
        name: `Contrato KL Minas - ${contractData.financialResponsible.name}`,
        base64_pdf: base64Pdf, // <<< CORRIGIDO: Adicionando o PDF ao payload
        auto_sign: {
          enabled: true,
          position_x: '65',
          position_y: '85',
          position_page: -1,
        },
        signers: [
          {
            name: contractData.financialResponsible.name,
            email: contractData.financialResponsible.email,
            phone_country: '55',
            phone_number: contractData.financialResponsible.phone.replace(
              /\D/g,
              '',
            ),
            auth_mode: 'assinatura_tela',
            position_x: '20',
            position_y: '85',
            position_page: -1,
            redirect_after_sign: `${process.env.FRONTEND_URL}/assinatura-sucesso?contractId=${contractId}`,
            get_sign_url: initiator === 'PARENT',
          },
        ],
      };

      const response = await axios.post(
        `${ZAPSIGN_BASE_URL}/docs/`,
        zapSignPayload,
        {
          headers: getZapSignHeaders(),
        },
      );
      const zapSignDocToken = response.data.token;

      // ATUALIZA O STATUS E SALVA O TOKEN DO ZAPSIGN
      await contractRef.update({
        status: 'sent_to_signature',
        zapSignToken: zapSignDocToken,
        sentToSignatureAt: new Date(),
      });

      let signUrl = null;
      if (initiator === 'PARENT' && response.data.signers[0].get_sign_url) {
        signUrl = response.data.signers[0].sign_url;
      }
      return res.status(200).json({
        success: true,
        message: 'Documento criado e enviado.',
        sign_url: signUrl,
      });
    }

    // CASO B: O contrato já existe no ZapSign ('sent_to_signature')
    if (contract.status === 'sent_to_signature') {
      console.log(
        `Documento para o contrato ${contractId} já existe. Usando token: ${contract.zapSignToken}`,
      );

      // Se o admin está agindo, ele quer reenviar o lembrete.
      if (initiator === 'ADMIN') {
        // A API do ZapSign tem um endpoint para reenviar notificações.
        // POST /api/v1/docs/{token}/resend-email-or-sms
        await axios.post(
          `${ZAPSIGN_BASE_URL}/docs/${contract.zapSignToken}/resend-email-or-sms`,
          {},
          {
            headers: getZapSignHeaders(),
          },
        );
        return res
          .status(200)
          .json({ success: true, message: 'Lembrete reenviado com sucesso.' });
      }

      // Se o pai está agindo, ele quer o link para assinar.
      if (initiator === 'PARENT') {
        // A API do ZapSign permite buscar os dados de um documento, incluindo as URLs de assinatura.
        // GET /api/v1/docs/{token}
        const response = await axios.get(
          `${ZAPSIGN_BASE_URL}/docs/${contract.zapSignToken}`,
          {
            headers: getZapSignHeaders(),
          },
        );
        const signUrl = response.data.signers[0].sign_url; // Encontra a URL do signatário (pai)
        return res.status(200).json({ success: true, sign_url: signUrl });
      }
    }

    // Se chegar aqui, algo está errado com o status.
    return res.status(500).json({ error: 'Estado do contrato inválido.' });
  } catch (error: any) {
    // Captura e loga o erro de forma mais detalhada
    console.error(
      'Erro ao enviar para ZapSign:',
      error.response?.data || error.message,
    );
    return res.status(500).json({ error: 'Falha ao processar o contrato.' });
  }
};

export const sendAddendumForSignature = async (req: Request, res: Response) => {
  const { addendumId, initiator } = req.body;

  if (!addendumId || !initiator) {
    return res
      .status(400)
      .json({ error: 'addendumId e initiator são obrigatórios.' });
  }

  try {
    const addendumRef = db.collection('contractAddendums').doc(addendumId);
    const addendumDoc = await addendumRef.get();
    if (!addendumDoc.exists) {
      return res.status(404).json({ error: 'Aditivo não encontrado.' });
    }
    const addendum = addendumDoc.data() as ContractAddendum;

    if (addendum.status === 'signed') {
      return res
        .status(400)
        .json({ error: 'Este aditivo já foi finalizado.' });
    }

    if (addendum.status === 'pending') {
      console.log(
        `Iniciando novo documento no ZapSign para o aditivo ${addendumId}...`,
      );

      const addendumData = await getAddendumSessionData(addendumId);
      const base64Pdf = await generateAddendumPdfAsBase64(addendumData);

      const zapSignPayload = {
        external_id: `addendum:${addendumId}`,
        name: `Aditivo KL Minas - ${addendumData.financialResponsible.name}`,
        base64_pdf: base64Pdf,
        auto_sign: {
          enabled: true,
          position_x: '65',
          position_y: '85',
          position_page: -1,
        },
        signers: [
          {
            name: addendumData.financialResponsible.name,
            email: addendumData.financialResponsible.email,
            phone_country: '55',
            phone_number: addendumData.financialResponsible.phone.replace(
              /\D/g,
              '',
            ),
            auth_mode: 'assinatura_tela',
            position_x: '20',
            position_y: '85',
            position_page: -1,
            redirect_after_sign: `${process.env.FRONTEND_URL}/assinatura-sucesso?addendumId=${addendumId}`,
            get_sign_url: initiator === 'PARENT',
          },
        ],
      };

      const response = await axios.post(
        `${ZAPSIGN_BASE_URL}/docs/`,
        zapSignPayload,
        {
          headers: getZapSignHeaders(),
        },
      );
      const zapSignDocToken = response.data.token;

      await addendumRef.update({
        status: 'sent',
        zapSignToken: zapSignDocToken,
        sentAt: new Date(),
      });

      let signUrl = null;
      if (initiator === 'PARENT' && response.data.signers[0].get_sign_url) {
        signUrl = response.data.signers[0].sign_url;
      }

      return res.status(200).json({
        success: true,
        message: 'Documento criado e enviado.',
        sign_url: signUrl,
      });
    }

    if (addendum.status === 'sent') {
      console.log(
        `Documento para o aditivo ${addendumId} já existe. Usando token: ${addendum.zapSignToken}`,
      );

      if (initiator === 'ADMIN') {
        await axios.post(
          `${ZAPSIGN_BASE_URL}/docs/${addendum.zapSignToken}/resend-email-or-sms`,
          {},
          {
            headers: getZapSignHeaders(),
          },
        );
        return res
          .status(200)
          .json({ success: true, message: 'Lembrete reenviado com sucesso.' });
      }

      if (initiator === 'PARENT') {
        const response = await axios.get(
          `${ZAPSIGN_BASE_URL}/docs/${addendum.zapSignToken}`,
          {
            headers: getZapSignHeaders(),
          },
        );
        const signUrl = response.data.signers[0].sign_url;
        return res.status(200).json({ success: true, sign_url: signUrl });
      }
    }

    return res.status(500).json({ error: 'Estado do aditivo inválido.' });
  } catch (error: any) {
    console.error(
      'Erro ao enviar aditivo para ZapSign:',
      error.response?.data || error.message,
    );
    return res.status(500).json({ error: 'Falha ao processar o aditivo.' });
  }
};

const createZapSignDocumentFromUploadedPdf = async ({
  externalId,
  name,
  pdfBuffer,
}: {
  externalId: string;
  name: string;
  pdfBuffer: Buffer;
}) => {
  const payload = {
    external_id: externalId,
    name,
    base64_pdf: pdfBuffer.toString('base64'),
    auto_sign: {
      enabled: true,
      position_x: '65',
      position_y: '85',
      position_page: -1,
    },
    signers: [],
  };

  const response = await axios.post(
    `${ZAPSIGN_BASE_URL}/docs/`,
    payload,
    { headers: getZapSignHeaders() },
  );

  return {
    token: response.data?.token as string | undefined,
  };
};

export const uploadSignedContractFile = async (req: Request, res: Response) => {
  const { contractId } = req.body;
  const file = (req as any).file as Express.Multer.File | undefined;
  const requesterUid = req.user?.uid;

  if (!requesterUid) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  if (!contractId || !file) {
    return res.status(400).json({ error: 'contractId e arquivo PDF são obrigatórios.' });
  }

  try {
    const contractRef = db.collection('contracts').doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      return res.status(404).json({ error: 'Contrato não encontrado.' });
    }
    const contract = contractSnap.data() as Contract;

    const canAccess = await canUserAccessResponsible(requesterUid, contract.financialResponsibleId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Você não tem permissão para este contrato.' });
    }
    if (contract.status === 'signed') {
      return res.status(409).json({ error: 'Contrato já assinado. Não é permitido sobrescrever.' });
    }
    if (contract.zapSignToken) {
      return res.status(409).json({ error: 'Contrato já enviado para assinatura. Upload bloqueado para evitar sobrescrita.' });
    }

    const responsibleSnap = await db
      .collection('financialResponsibles')
      .doc(contract.financialResponsibleId)
      .get();
    const responsible = responsibleSnap.exists
      ? (responsibleSnap.data() as { name?: string })
      : { name: 'Responsável' };

    const created = await createZapSignDocumentFromUploadedPdf({
      externalId: contractId,
      name: `Contrato Assinado (Upload) - ${responsible.name || contractId}`,
      pdfBuffer: file.buffer,
    });

    if (!created.token) {
      return res.status(500).json({ error: 'ZapSign não retornou token do documento.' });
    }

    await contractRef.update({
      status: 'sent_to_signature',
      provider: 'ZapSign',
      zapSignToken: created.token,
      providerToken: created.token,
      sentToSignatureAt: new Date(),
      uploadSource: 'manual_signed_upload',
      uploadSignedFileName: file.originalname,
      uploadSignedBy: requesterUid,
      uploadSignedAt: new Date(),
    } as any);

    return res.status(200).json({
      success: true,
      message: 'Arquivo enviado para armazenamento e assinatura automática na ZapSign.',
    });
  } catch (error: any) {
    console.error('Erro no upload assinado de contrato:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao enviar arquivo assinado do contrato.' });
  }
};

export const uploadSignedAddendumFile = async (req: Request, res: Response) => {
  const { addendumId } = req.body;
  const file = (req as any).file as Express.Multer.File | undefined;
  const requesterUid = req.user?.uid;

  if (!requesterUid) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  if (!addendumId || !file) {
    return res.status(400).json({ error: 'addendumId e arquivo PDF são obrigatórios.' });
  }

  try {
    const addendumRef = db.collection('contractAddendums').doc(addendumId);
    const addendumSnap = await addendumRef.get();
    if (!addendumSnap.exists) {
      return res.status(404).json({ error: 'Aditivo não encontrado.' });
    }
    const addendum = addendumSnap.data() as ContractAddendum;

    const canAccess = await canUserAccessResponsible(requesterUid, addendum.financialResponsibleId);
    if (!canAccess) {
      return res.status(403).json({ error: 'Você não tem permissão para este aditivo.' });
    }
    if (addendum.status === 'signed') {
      return res.status(409).json({ error: 'Aditivo já assinado. Não é permitido sobrescrever.' });
    }
    if (addendum.zapSignToken) {
      return res.status(409).json({ error: 'Aditivo já enviado para assinatura. Upload bloqueado para evitar sobrescrita.' });
    }

    const responsibleSnap = await db
      .collection('financialResponsibles')
      .doc(addendum.financialResponsibleId)
      .get();
    const responsible = responsibleSnap.exists
      ? (responsibleSnap.data() as { name?: string })
      : { name: 'Responsável' };

    const created = await createZapSignDocumentFromUploadedPdf({
      externalId: `addendum:${addendumId}`,
      name: `Aditivo Assinado (Upload) - ${responsible.name || addendumId}`,
      pdfBuffer: file.buffer,
    });

    if (!created.token) {
      return res.status(500).json({ error: 'ZapSign não retornou token do documento.' });
    }

    await addendumRef.update({
      status: 'sent',
      provider: 'ZapSign',
      zapSignToken: created.token,
      providerToken: created.token,
      sentAt: new Date(),
      uploadSource: 'manual_signed_upload',
      uploadSignedFileName: file.originalname,
      uploadSignedBy: requesterUid,
      uploadSignedAt: new Date(),
    } as any);

    return res.status(200).json({
      success: true,
      message: 'Arquivo enviado para armazenamento e assinatura automática na ZapSign.',
    });
  } catch (error: any) {
    console.error('Erro no upload assinado de aditivo:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao enviar arquivo assinado do aditivo.' });
  }
};

export const getContractSignedFile = async (req: Request, res: Response) => {
  const { contractId } = req.params;
  const requesterUid = req.user?.uid;
  if (!requesterUid) return res.status(401).json({ error: 'Usuário não autenticado.' });

  try {
    const contractRef = db.collection('contracts').doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) return res.status(404).json({ error: 'Contrato não encontrado.' });

    const contract = contractSnap.data() as Contract;
    const canAccess = await canUserAccessResponsible(requesterUid, contract.financialResponsibleId);
    if (!canAccess) return res.status(403).json({ error: 'Sem permissão para este contrato.' });

    if (contract.status !== 'signed') {
      return res.status(409).json({ error: 'Contrato ainda não está assinado.' });
    }

    let signedFileUrl = (contract as any).signedFileUrl as string | undefined;
    if (!signedFileUrl && contract.zapSignToken) {
      signedFileUrl = await getSignedFileUrlFromZapSign(contract.zapSignToken) || undefined;
      if (signedFileUrl) {
        await contractRef.update({ signedFileUrl });
      }
    }

    if (!signedFileUrl) {
      return res.status(404).json({ error: 'Arquivo assinado ainda indisponível na ZapSign.' });
    }

    return res.status(200).json({ success: true, signedFileUrl });
  } catch (error: any) {
    console.error('Erro ao recuperar contrato assinado:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao recuperar contrato assinado.' });
  }
};

export const getAddendumSignedFile = async (req: Request, res: Response) => {
  const { addendumId } = req.params;
  const requesterUid = req.user?.uid;
  if (!requesterUid) return res.status(401).json({ error: 'Usuário não autenticado.' });

  try {
    const addendumRef = db.collection('contractAddendums').doc(addendumId);
    const addendumSnap = await addendumRef.get();
    if (!addendumSnap.exists) return res.status(404).json({ error: 'Aditivo não encontrado.' });

    const addendum = addendumSnap.data() as ContractAddendum;
    const canAccess = await canUserAccessResponsible(requesterUid, addendum.financialResponsibleId);
    if (!canAccess) return res.status(403).json({ error: 'Sem permissão para este aditivo.' });

    if (addendum.status !== 'signed') {
      return res.status(409).json({ error: 'Aditivo ainda não está assinado.' });
    }

    let signedFileUrl = (addendum as any).signedFileUrl as string | undefined;
    if (!signedFileUrl && addendum.zapSignToken) {
      signedFileUrl = await getSignedFileUrlFromZapSign(addendum.zapSignToken) || undefined;
      if (signedFileUrl) {
        await addendumRef.update({ signedFileUrl });
      }
    }

    if (!signedFileUrl) {
      return res.status(404).json({ error: 'Arquivo assinado ainda indisponível na ZapSign.' });
    }

    return res.status(200).json({ success: true, signedFileUrl });
  } catch (error: any) {
    console.error('Erro ao recuperar aditivo assinado:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Falha ao recuperar aditivo assinado.' });
  }
};

export const zapSignWebhookHandler = async (req: Request, res: Response) => {
  const event = req.body;

  // É uma boa prática verificar se a requisição veio mesmo do ZapSign,
  // mas por simplicidade vamos pular essa parte por enquanto.

  if (event.event.type === 'doc_signed') {
    const externalId: string = event.doc.external_id;

    try {
      if (externalId.startsWith('addendum:')) {
        const addendumId = externalId.replace('addendum:', '');
        const addendumRef = db.collection('contractAddendums').doc(addendumId);
        await addendumRef.update({
          status: 'signed',
          provider: 'ZapSign',
          providerToken: event?.doc?.token || null,
          signedFileUrl: event?.doc?.signed_file || null,
          signedAt: new Date(),
        });
        console.log(`Aditivo ${addendumId} atualizado para 'signed'.`);
      } else {
        const contractId = externalId;
        const contractRef = db.collection('contracts').doc(contractId);
        await contractRef.update({
          status: 'signed',
          provider: 'ZapSign',
          providerToken: event?.doc?.token || null,
          signedFileUrl: event?.doc?.signed_file || null,
          signedAt: new Date(),
        });
        console.log(`Contrato ${contractId} atualizado para 'signed'.`);
      }
    } catch (error) {
      console.error(
        `Erro ao atualizar documento via webhook:`,
        error,
      );
    }
  }

  // Responda ao ZapSign com status 200 para confirmar o recebimento.
  res.sendStatus(200);
};
