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

const normalizePhone = (value: string | undefined | null) =>
  String(value || '').replace(/\D/g, '');

const ZAPSIGN_PARENT_SIGNATURE_ANCHOR =
  process.env.ZAPSIGN_PARENT_SIGNATURE_ANCHOR || '<<signer_parent>>';
const ZAPSIGN_SCHOOL_SIGNATURE_ANCHOR =
  process.env.ZAPSIGN_SCHOOL_SIGNATURE_ANCHOR || '<<signer_school>>';
const ZAPSIGN_SCHOOL_AS_SIGNER =
  String(process.env.ZAPSIGN_SCHOOL_AS_SIGNER || 'false').toLowerCase() ===
  'true';
const ZAPSIGN_SCHOOL_SIGNER_NAME =
  process.env.ZAPSIGN_SCHOOL_SIGNER_NAME || 'KL Minas Esportes LTDA';
const ZAPSIGN_SCHOOL_SIGNER_EMAIL =
  process.env.ZAPSIGN_SCHOOL_SIGNER_EMAIL || '';
const ZAPSIGN_SCHOOL_SIGNER_PHONE = normalizePhone(
  process.env.ZAPSIGN_SCHOOL_SIGNER_PHONE || '',
);
const ZAPSIGN_DEBUG_LOG_FULL_TOKEN =
  String(process.env.ZAPSIGN_DEBUG_LOG_FULL_TOKEN || 'false').toLowerCase() ===
  'true';

const getZapSignHeaders = () => {
  if (!ZAPSIGN_API_TOKEN) {
    throw new Error('ZAPSIGN_API_TOKEN não configurado no backend.');
  }
  return {
    Authorization: `Bearer ${ZAPSIGN_API_TOKEN}`,
  };
};

const getSafeTokenForLog = () => {
  if (!ZAPSIGN_API_TOKEN) return 'TOKEN_AUSENTE';
  if (ZAPSIGN_DEBUG_LOG_FULL_TOKEN) return ZAPSIGN_API_TOKEN;
  if (ZAPSIGN_API_TOKEN.length <= 12) return ZAPSIGN_API_TOKEN;
  return `${ZAPSIGN_API_TOKEN.slice(0, 6)}...${ZAPSIGN_API_TOKEN.slice(-4)}`;
};

const logZapSignRuntime = (scope: 'contract' | 'addendum', id: string) => {
  console.log(
    `[ZapSign][${scope}:${id}] env=${ZAPSIGN_ENV} base=${ZAPSIGN_BASE_URL} token=${getSafeTokenForLog()} mode=${
      ZAPSIGN_SCHOOL_AS_SIGNER ? 'school_as_signer' : 'auto_sign'
    }`,
  );
  console.log(
    `[ZapSign][${scope}:${id}] conferir token em: ZapSign > Configurações > Integrações > API ZapSign (mesmo ambiente: sandbox/producao).`,
  );
};

const getResponsiblePhoneDigits = (responsible: any): string => {
  const candidates: Array<string | undefined | null> = [
    responsible?.phone,
    responsible?.phonePrimary,
    responsible?.phoneSecondary,
    responsible?.phoneTertiary,
    responsible?.phones?.primary,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate);
    if (normalized) return normalized;
  }

  const objectCandidates = [
    responsible?.phonePrimary,
    responsible?.phoneSecondary,
    responsible?.phoneTertiary,
  ];
  for (const candidate of objectCandidates) {
    if (candidate && typeof candidate === 'object') {
      const ddd = String(candidate.ddd || '').replace(/\D/g, '');
      const number = String(candidate.number || '').replace(/\D/g, '');
      if (ddd || number) return `${ddd}${number}`;
    }
  }

  return '';
};

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

const extractSignerUrl = (
  docPayload: any,
  targetEmail?: string | null,
): string | null => {
  const signers = Array.isArray(docPayload?.signers) ? docPayload.signers : [];
  if (signers.length === 0) return null;

  const email = String(targetEmail || '').trim().toLowerCase();
  if (email) {
    const exact = signers.find(
      (s: any) => String(s?.email || '').trim().toLowerCase() === email,
    );
    if (exact?.sign_url) return String(exact.sign_url);
  }

  const firstWithUrl = signers.find((s: any) => Boolean(s?.sign_url));
  return firstWithUrl?.sign_url ? String(firstWithUrl.sign_url) : null;
};

const buildSignerPayload = (
  responsible: any,
  signerPhone: string,
  initiator: 'ADMIN' | 'PARENT',
  redirectAfterSign: string,
) => {
  const signers: any[] = [
    {
      name: responsible.name,
      email: responsible.email,
      phone_country: '55',
      phone_number: signerPhone,
      auth_mode: 'assinatura_tela',
      signature_placement: ZAPSIGN_PARENT_SIGNATURE_ANCHOR,
      position_x: '20',
      position_y: '85',
      position_page: -1,
      redirect_after_sign: redirectAfterSign,
      get_sign_url: initiator === 'PARENT',
    },
  ];

  // Modo opcional: escola como signatário explícito para aparecer como 2/2.
  // Exige ação de assinatura da escola no fluxo atual da ZapSign.
  if (ZAPSIGN_SCHOOL_AS_SIGNER && ZAPSIGN_SCHOOL_SIGNER_EMAIL) {
    signers.push({
      name: ZAPSIGN_SCHOOL_SIGNER_NAME,
      email: ZAPSIGN_SCHOOL_SIGNER_EMAIL,
      phone_country: '55',
      phone_number: ZAPSIGN_SCHOOL_SIGNER_PHONE || undefined,
      auth_mode: 'assinatura_tela',
      signature_placement: ZAPSIGN_SCHOOL_SIGNATURE_ANCHOR,
      position_x: '65',
      position_y: '85',
      position_page: -1,
      get_sign_url: false,
      send_automatic_email: false,
    });
  }

  return {
    signers,
    auto_sign: ZAPSIGN_SCHOOL_AS_SIGNER
      ? undefined
      : {
          enabled: true,
          signature_placement: ZAPSIGN_SCHOOL_SIGNATURE_ANCHOR,
          position_x: '65',
          position_y: '85',
          position_page: -1,
        },
  };
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
    logZapSignRuntime('contract', contractId);
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
      const signerPhone = getResponsiblePhoneDigits(
        contractData.financialResponsible,
      );
      if (!signerPhone) {
        throw new Error(
          'Responsável financeiro sem telefone válido para envio à ZapSign.',
        );
      }

      const signerConfig = buildSignerPayload(
        contractData.financialResponsible,
        signerPhone,
        initiator,
        `${process.env.FRONTEND_URL}/assinatura-sucesso?contractId=${contractId}`,
      );

      const zapSignPayload = {
        external_id: contractId,
        name: `Contrato KL Minas - ${contractData.financialResponsible.name}`,
        base64_pdf: base64Pdf, // <<< CORRIGIDO: Adicionando o PDF ao payload
        auto_sign: signerConfig.auto_sign,
        signers: signerConfig.signers,
      };

      const response = await axios.post(
        `${ZAPSIGN_BASE_URL}/docs/`,
        zapSignPayload,
        {
          headers: getZapSignHeaders(),
        },
      );
      const zapSignDocToken = response.data.token;
      console.log(
        `[ZapSign][contract:${contractId}] documento criado. token=${zapSignDocToken}`,
      );

      // ATUALIZA O STATUS E SALVA O TOKEN DO ZAPSIGN
      await contractRef.update({
        status: 'sent_to_signature',
        zapSignToken: zapSignDocToken,
        sentToSignatureAt: new Date(),
      });

      let signUrl: string | null = null;
      if (initiator === 'PARENT') {
        signUrl = extractSignerUrl(
          response.data,
          contractData.financialResponsible.email,
        );
        if (!signUrl && zapSignDocToken) {
          const docResponse = await axios.get(
            `${ZAPSIGN_BASE_URL}/docs/${zapSignDocToken}`,
            { headers: getZapSignHeaders() },
          );
          signUrl = extractSignerUrl(
            docResponse.data,
            contractData.financialResponsible.email,
          );
        }
        console.log(
          `[ZapSign][contract:${contractId}] sign_url ${
            signUrl ? 'obtida' : 'não encontrada'
          } para initiator=PARENT`,
        );
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
        const signUrl = extractSignerUrl(response.data);
        console.log(
          `[ZapSign][contract:${contractId}] sign_url ${
            signUrl ? 'obtida' : 'não encontrada'
          } no fluxo sent_to_signature`,
        );
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
    logZapSignRuntime('addendum', addendumId);
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
      const signerPhone = getResponsiblePhoneDigits(
        addendumData.financialResponsible,
      );
      if (!signerPhone) {
        throw new Error(
          'Responsável financeiro sem telefone válido para envio à ZapSign.',
        );
      }

      const signerConfig = buildSignerPayload(
        addendumData.financialResponsible,
        signerPhone,
        initiator,
        `${process.env.FRONTEND_URL}/assinatura-sucesso?addendumId=${addendumId}`,
      );

      const zapSignPayload = {
        external_id: `addendum:${addendumId}`,
        name: `Aditivo KL Minas - ${addendumData.financialResponsible.name}`,
        base64_pdf: base64Pdf,
        auto_sign: signerConfig.auto_sign,
        signers: signerConfig.signers,
      };

      const response = await axios.post(
        `${ZAPSIGN_BASE_URL}/docs/`,
        zapSignPayload,
        {
          headers: getZapSignHeaders(),
        },
      );
      const zapSignDocToken = response.data.token;
      console.log(
        `[ZapSign][addendum:${addendumId}] documento criado. token=${zapSignDocToken}`,
      );

      await addendumRef.update({
        status: 'sent',
        zapSignToken: zapSignDocToken,
        sentAt: new Date(),
      });

      let signUrl: string | null = null;
      if (initiator === 'PARENT') {
        signUrl = extractSignerUrl(
          response.data,
          addendumData.financialResponsible.email,
        );
        if (!signUrl && zapSignDocToken) {
          const docResponse = await axios.get(
            `${ZAPSIGN_BASE_URL}/docs/${zapSignDocToken}`,
            { headers: getZapSignHeaders() },
          );
          signUrl = extractSignerUrl(
            docResponse.data,
            addendumData.financialResponsible.email,
          );
        }
        console.log(
          `[ZapSign][addendum:${addendumId}] sign_url ${
            signUrl ? 'obtida' : 'não encontrada'
          } para initiator=PARENT`,
        );
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
        const signUrl = extractSignerUrl(response.data);
        console.log(
          `[ZapSign][addendum:${addendumId}] sign_url ${
            signUrl ? 'obtida' : 'não encontrada'
          } no fluxo sent`,
        );
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
  const payload = req.body || {};

  // É uma boa prática verificar se a requisição veio mesmo do ZapSign,
  // mas por simplicidade vamos pular essa parte por enquanto.

  const eventTypeRaw =
    payload?.event?.type ||
    payload?.event_type ||
    payload?.type ||
    '';
  const eventType = String(eventTypeRaw).toLowerCase();
  const docPayloadCandidate =
    payload?.doc ||
    payload?.document ||
    payload?.event?.doc ||
    payload?.data?.doc ||
    payload?.data?.document ||
    null;
  const docPayload =
    docPayloadCandidate ||
    (payload?.external_id || payload?.externalId
      ? payload
      : payload?.data?.external_id || payload?.data?.externalId
      ? payload.data
      : null);

  const isSignedEvent =
    eventType === 'doc_signed' ||
    eventType === 'document_signed' ||
    eventType === 'document.signed';

  if (!isSignedEvent || !docPayload) {
    console.log(
      `[ZapSign][webhook] evento ignorado. type=${
        eventType || 'desconhecido'
      } hasDoc=${Boolean(docPayload)}`,
    );
    return res.sendStatus(200);
  }

  const externalId: string = String(
    docPayload?.external_id || docPayload?.externalId || '',
  );
  if (!externalId) {
    console.warn('[ZapSign][webhook] external_id ausente no payload.');
    return res.sendStatus(200);
  }

  try {
    const providerToken =
      docPayload?.token || docPayload?.doc_token || docPayload?.id || null;
    const signedFileUrl =
      docPayload?.signed_file ||
      docPayload?.signed_file_url ||
      docPayload?.download_url ||
      null;

    if (externalId.startsWith('addendum:')) {
      const addendumId = externalId.replace('addendum:', '');
      const addendumRef = db.collection('contractAddendums').doc(addendumId);
      await addendumRef.update({
        status: 'signed',
        provider: 'ZapSign',
        providerToken,
        signedFileUrl,
        signedAt: new Date(),
      });
      console.log(`Aditivo ${addendumId} atualizado para 'signed'.`);
    } else {
      const contractId = externalId;
      const contractRef = db.collection('contracts').doc(contractId);
      await contractRef.update({
        status: 'signed',
        provider: 'ZapSign',
        providerToken,
        signedFileUrl,
        signedAt: new Date(),
      });
      console.log(`Contrato ${contractId} atualizado para 'signed'.`);
    }
  } catch (error) {
    console.error(`Erro ao atualizar documento via webhook:`, error);
  }

  // Responda ao ZapSign com status 200 para confirmar o recebimento.
  res.sendStatus(200);
};
