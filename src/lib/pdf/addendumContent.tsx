import type { AddendumSessionData } from '../../types';

export type ParagraphChild =
  | string
  | { text: string; style: 'bold' | 'underline' };

export type AddendumContentBlock =
  | { type: 'h1'; text: string }
  | { type: 'p'; children: ParagraphChild[] }
  | { type: 'h3'; text: string }
  | { type: 'reasonChecklist' }
  | { type: 'table' }
  | { type: 'date' }
  | { type: 'signatures' };

export const getAddendumContent = (
  data: AddendumSessionData,
): AddendumContentBlock[] => {
  const { financialResponsible: resp } = data;

  return [
    {
      type: 'h1',
      text: `ADITIVO CONTRATUAL – ANEXO II - CONTRATO DE PRESTAÇÃO DE SERVIÇOS ${data.year}`,
    },
    {
      type: 'p',
      children: [
        'Pelo presente instrumento, de um lado ',
        { text: 'KL MINAS ESPORTES LTDA', style: 'bold' },
        ', inscrita no CNPJ nº ',
        { text: '13.839.322/0001-70', style: 'bold' },
        ', doravante denominada ',
        { text: 'CONTRATADA', style: 'bold' },
        ', e, de outro lado, o(a) Sr.(a) ',
        { text: resp.name || '______________________________________', style: 'bold' },
        ', CPF nº ',
        { text: resp.document || '________________________', style: 'bold' },
        ', residente à ',
        {
          text:
            resp.address
              ? `${resp.address.street}, ${resp.address.number}${resp.address.complement ? ` ${resp.address.complement}` : ''} - ${resp.address.neighborhood}, ${resp.address.zipCode}, ${resp.address.city}-${resp.address.state}`
              : '_______________________________________________',
          style: 'bold',
        },
        ', doravante denominado(a) ',
        { text: 'CONTRATANTE', style: 'bold' },
        ', resolvem celebrar o presente ',
        { text: 'ADITIVO CONTRATUAL', style: 'bold' },
        ', nos termos da Cláusula 6ª, § 3º do contrato principal.',
      ],
    },
    { type: 'h3', text: 'Cláusula 1ª – DO OBJETO DO ADITIVO' },
    {
      type: 'p',
      children: [
        'O presente aditivo tem por finalidade formalizar a(s) seguinte(s) alteração(s) nas condições inicialmente pactuadas:',
      ],
    },
    { type: 'reasonChecklist' },
    { type: 'h3', text: 'Cláusula 2ª – DA REVISÃO DE VALORES' },
    {
      type: 'p',
      children: [
        'Conforme a alteração selecionada, os valores de matrícula e/ou mensalidade serão automaticamente recalculados de acordo com:',
      ],
    },
    {
      type: 'p',
      children: [
        'a) Taxa Base (TB), fator de ajuste e regras de proporcionalidade anual vigentes no contrato principal;',
      ],
    },
    {
      type: 'p',
      children: [
        'b) Política de descontos por irmãos, múltiplos cursos ou alunos do integral, quando aplicáveis;',
      ],
    },
    {
      type: 'p',
      children: [
        'c) Atualização da Tabela de Detalhamento Contratual (Anexo I), que passa a vigorar com os novos dados após assinatura deste aditivo.',
      ],
    },
    {
      type: 'h3',
      text: 'Cláusula 3ª – DA NÃO DEVOLUÇÃO DA TAXA DE MATRÍCULA EM CASO DE REDUÇÃO DE VALOR',
    },
    {
      type: 'p',
      children: ['Fica pactuado entre as partes que:'],
    },
    {
      type: 'p',
      children: [
        'I – Caso a alteração contratual resulte em redução da frequência semanal, exclusão de modalidades ou qualquer modificação que implique diminuição do valor final da Taxa de Matrícula, ',
        { text: 'NÃO', style: 'bold' },
        ' haverá devolução, restituição ou crédito referente ao valor de matrícula já pago.',
      ],
    },
    {
      type: 'p',
      children: [
        'II – A Taxa de Matrícula, conforme previsto no contrato principal, corresponde a custo administrativo mínimo e à reserva de vaga, não sendo reembolsável após a efetivação da matrícula, independentemente de alterações futuras que reduzam o valor originalmente calculado.',
      ],
    },
    {
      type: 'p',
      children: [
        'III – A alteração passará a gerar efeitos financeiros apenas para as mensalidades subsequentes, não retroagindo para períodos anteriores.',
      ],
    },
    {
      type: 'h3',
      text: 'Cláusula 4ª – Tabela de Detalhamento Contratual (Anexo I). Após alteração solicitada pelo CONTRATANTE, segue nova tabela de valores:',
    },
    { type: 'table' },
    { type: 'h3', text: 'Cláusula 4ª – VIGÊNCIA' },
    {
      type: 'p',
      children: [
        `Este aditivo entra em vigor na data de assinatura pelas partes e integra plenamente o Contrato de Prestação de Serviços ${data.year}, mantendo-se inalteradas todas as demais cláusulas não modificadas por este documento.`,
      ],
    },
    { type: 'date' },
    { type: 'signatures' },
  ];
};
