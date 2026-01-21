/* eslint-disable @typescript-eslint/no-explicit-any */
// Em: src/controllers/contractController.tsx

import { Request, Response } from 'express';
import axios from 'axios';
// --- MUDANÇA NA IMPORTAÇÃO ---
import { renderToStream } from '@react-pdf/renderer';
import { ContractPDFDocument } from '../lib/pdf/ContractPDFDocument';
import { getContractSessionData } from '../lib/firestoreApi';
import { db } from '../lib/firebaseAdmin';
import { ContractSessionData } from '../types'; // <<< Importar o tipo

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
    // 1. Buscar os dados do contrato
    const contractData = await getContractSessionData(contractId);

    // 2. Gerar o PDF em Base64
    const base64Pdf = await generatePdfAsBase64(contractData);

    // 3. Montar o payload completo para o ZapSign
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

    // 4. Chamar a API do ZapSign
    const response = await axios.post(
      'https://api.zapsign.com.br/api/v1/docs/',
      zapSignPayload,
      {
        headers: { Authorization: `Bearer ${process.env.ZAPSIGN_API_TOKEN}` },
      },
    );

    const zapSignDocToken = response.data.token;
    let signUrl = null;
    if (initiator === 'PARENT' && response.data.signers[0].get_sign_url) {
      signUrl = response.data.signers[0].sign_url;
    }

    // 5. Atualizar o status no Firestore
    await db.collection('contracts').doc(contractId).update({
      status: 'sent_to_signature',
      zapSignToken: zapSignDocToken,
      sentToSignatureAt: new Date(),
    });

    // 6. Retornar sucesso
    return res.status(200).json({ success: true, sign_url: signUrl });
  } catch (error: any) {
    // Captura e loga o erro de forma mais detalhada
    console.error(
      'Erro ao enviar para ZapSign:',
      error.response?.data || error.message,
    );
    return res.status(500).json({ error: 'Falha ao processar o contrato.' });
  }
};

export const zapSignWebhookHandler = async (req: Request, res: Response) => {
  const event = req.body;

  // É uma boa prática verificar se a requisição veio mesmo do ZapSign,
  // mas por simplicidade vamos pular essa parte por enquanto.

  if (event.event.type === 'doc_signed') {
    const contractId = event.doc.external_id;

    try {
      const contractRef = db.collection('contracts').doc(contractId);
      await contractRef.update({
        status: 'signed',
        signedAt: new Date(),
      });
      console.log(`Contrato ${contractId} atualizado para 'signed'.`);
    } catch (error) {
      console.error(
        `Erro ao atualizar contrato ${contractId} via webhook:`,
        error,
      );
    }
  }

  // Responda ao ZapSign com status 200 para confirmar o recebimento.
  res.sendStatus(200);
};
