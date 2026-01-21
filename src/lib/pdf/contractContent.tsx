// src/features/contracts/contractContent.tsx
import type { ContractSessionData } from '../../types';

export type ParagraphChild =
  | string
  | { text: string; style: 'bold' | 'underline' };

export type ContentBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; children: ParagraphChild[] }
  | { type: 'table' }
  | { type: 'date' }
  | { type: 'signatures' };

export const getContractContent = (
  data: ContractSessionData,
  currentYear: number,
): ContentBlock[] => {
  const { financialResponsible: resp } = data;

  return [
    { type: 'h1', text: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ${currentYear}` },
    { type: 'h2', text: 'KL MINAS ESPORTES' },

    {
      type: 'p',
      children: [
        'A ',
        { text: 'KL Minas Esportes Ltda', style: 'bold' },
        ', INSCRITA NO CNPJ sob nº ',
        { text: '13.839.322/0001-70', style: 'bold' },
        ', situada na Rua Desembargador Amílcar de Castro, 631, Belo Horizonte/MG, Cep 30.494-390, doravante denominada simplesmente ',
        { text: 'CONTRATADA', style: 'bold' },
        ' e, por outro lado, o Sr. ou Sra. ',
        {
          text: resp.name || '___________________________________',
          style: 'bold',
        },
        ', CPF nº ',
        { text: resp.document || '_________________', style: 'bold' },
        ', residente e domiciliado(a) à ',
        {
          text: `${resp.address.street}, ${resp.address.number} ${resp.address.complement} - ${resp.address.neighborhood}, ${resp.address.zipCode}, ${resp.address.city}-${resp.address.state}`,
          style: 'bold',
        },
        ', doravante designado simplesmente ',
        { text: 'CONTRATANTE', style: 'bold' },
        `, firmam, para o ano de ${currentYear}, o presente Contrato de Prestação de Serviços de Atividades Extracurriculares.`,
      ],
    },

    { type: 'h3', text: 'Cláusula 1ª: DO OBJETIVO' },
    {
      type: 'p',
      children: [
        'O presente contrato tem por objeto a prestação de serviços de aulas esportivas e/ou culturais na Escola de Esportes, conforme o(s) aluno(s), a(s) modalidade(s), frequência e período descritos na Tabela de Detalhamento Contratual (Anexo I - Cláusula 2ª, §9º), com base no calendário da unidade escolar, considerando os dias letivos, feriados e recessos.',
      ],
    },
    {
      type: 'p',
      children: [
        '§1º O presente contrato é válido pelo período contratado, observadas suas demais cláusulas, não havendo compromisso de continuidade para o período letivo seguinte.',
      ],
    },
    {
      type: 'p',
      children: [
        '§2° O referido curso extra não tem caráter curricular, caracterizando-se como atividade extraordinária e opcional.',
      ],
    },

    { type: 'h3', text: 'Cláusula 2ª: DA MATRÍCULA, MENSALIDADE E DESCONTOS' },
    {
      type: 'p',
      children: [
        'Para a consecução dos objetivos deste curso, o CONTRATANTE pagará à CONTRATADA o valor de matrícula, acrescido de parcelas mensais e consecutivas, conforme detalhado no §9º - Anexo I.',
      ],
    },

    {
      type: 'p',
      children: [
        {
          text: '§1º DA TAXA DE MATRÍCULA E PROPORCIONALIDADE ANUAL',
          style: 'bold',
        },
      ],
    },
    {
      type: 'p',
      children: [
        'a) Taxa Base (TB): Fica estabelecida a Taxa Base (TB) de R$ 212,00 (Duzentos e doze reais), referente ao custo mínimo administrativo para o aluno com a menor utilização (ex: 1 vez por semana e 1 modalidade).',
      ],
    },
    {
      type: 'p',
      children: [
        'b) Cálculo da Taxa de Matrícula: O valor final da Taxa de Matrícula será a multiplicação da Taxa Base (TB) por um Fator de Ajuste (descrito abaixo), o qual considera a frequência semanal total do aluno(a) (somatória de aulas de todas as modalidades), aplicando um desconto progressivo para maior frequência, refletindo o custo-benefício e a não-abusividade.',
      ],
    },
    {
      type: 'p',
      children: ['A. Matrículas 1x por semana: TB (R$212,00).'],
    },
    {
      type: 'p',
      children: ['B. Matrículas 2x por semana: TBx1,7 (R$360,40).'],
    },
    {
      type: 'p',
      children: ['C. Matrículas 3x por semana: TBx1,8 (R$381,60).'],
    },
    {
      type: 'p',
      children: ['D. Matrículas 4x por semana: TBx1,9 (R$402,80).'],
    },
    {
      type: 'p',
      children: ['E. Matrículas 5x por semana: TBx2,0 (R$424,00).'],
    },

    {
      type: 'p',
      children: [
        'c) Proporcionalidade Anual da Taxa de Matrícula (Cálculo sobre o valor final da Taxa):',
      ],
    },
    {
      type: 'p',
      children: [
        'A. Matrículas efetivadas até Março: 100% do valor final da Taxa de Matrícula.',
      ],
    },
    {
      type: 'p',
      children: [
        'B. Matrículas efetivadas de Abril a Junho: 75% do valor final da Taxa de Matrícula.',
      ],
    },
    {
      type: 'p',
      children: [
        'C. Matrículas efetivadas de Julho a Setembro: 50% do valor final da Taxa de Matrícula.',
      ],
    },
    {
      type: 'p',
      children: [
        'D. Matrículas efetivadas de Outubro a Dezembro: 25% do valor final da Taxa de Matrícula.',
      ],
    },

    {
      type: 'p',
      children: [
        `§2º As parcelas mensais e consecutivas terão vencimento todo dia 05 (cinco) de cada mês de forma antecipada à realização da atividade, vencendo a primeira parcela no mês de início das atividades e a última em 05/12/${currentYear}, através das opções de pagamento via sistema.`,
      ],
    },
    {
      type: 'p',
      children: [
        '§3º Os alunos que ingressarem após o início das atividades em fevereiro, somente pagarão pelas parcelas vincendas, ou seja, vencidas a partir do mês da contratação.',
      ],
    },
    {
      type: 'p',
      children: [
        '§4º Matrículas efetuadas durante o mês terão a primeira mensalidade calculada proporcionalmente às aulas a realizar.',
      ],
    },
    {
      type: 'p',
      children: [
        '§5º Será concedido 10% de desconto na mensalidade de menor valor em caso de IRMÃOS matriculados em qualquer curso esportivo.',
      ],
    },
    {
      type: 'p',
      children: [
        '§6º Será concedido 10% de desconto na(s) mensalidade(s) de menor valor a partir do 2º curso, para o aluno(a) matriculado em dois ou mais cursos esportivos.',
      ],
    },
    {
      type: 'p',
      children: [
        '§7º Será concedido 10% de desconto na(s) mensalidade(s) do aluno que for filho de funcionário do Bernoulli.',
      ],
    },

    {
      type: 'p',
      children: [
        '§8º DA CONDIÇÃO ESPECIAL PARA ALUNOS DO PERÍODO INTEGRAL (COLÉGIO BERNOULLI) Quando o aluno for matriculado no Período Integral do Colégio Bernoulli, e as atividades esportivas da KL Minas estiverem inclusas no pacote do Integral: a) Não haverá cobrança de matrícula e mensalidade para o CONTRATANTE neste contrato. b) Caso o aluno utilize os serviços da CONTRATADA em frequência ou modalidades que excedam o período coberto pelo Colégio Integral (Ex: Integral cobre 3x/semana e o aluno frequenta aulas da KL MINAS ESPORTES 5x/semana), o CONTRATANTE será o único responsável pelo pagamento de mensalidade referente ao número de vezes excedente (Ex: as 2x/semana extras) acrescido de taxa de matrícula, conforme o valor estipulado no §1º e detalhado no §9º.',
      ],
    },

    {
      type: 'p',
      children: [
        '§9º Tabela de Detalhamento Contratual (Anexo I): A presente tabela resume as informações financeiras e de modalidade do(s) aluno(s).',
      ],
    },
    { type: 'table' },

    { type: 'h3', text: 'Cláusula 3ª: DAS FORMAS DE PAGAMENTO E ENCARGOS' },

    {
      type: 'p',
      children: [
        '§1º Havendo atraso no pagamento de quaisquer das parcelas descritas neste contrato, o CONTRATANTE pagará o valor em atraso acrescido de: a) Multa de 2% (dois por cento) sobre o valor da parcela em atraso, conforme legislação consumerista. b) Juros de 1% (hum por cento) ao mês, acréscimos esses que serão computados e exigidos desde a data do vencimento até a data do efetivo pagamento.',
      ],
    },

    {
      type: 'p',
      children: [
        '§2º Ocorrendo atraso por mais de 30 dias será enviado automaticamente notificação de cobrança do valor em atraso inclusive dos encargos desta Cláusula, e após 60 (sessenta) dias, além dos encargos supra descritos, poderá a CONTRATADA inscrever o devedor em cadastro ou serviço de proteção ao crédito (SPC, CDL, SERASA ou outro órgão afim) e ainda efetivar o cancelamento do contrato e exclusão do aluno nas aulas.',
      ],
    },

    {
      type: 'p',
      children: [
        '§3º O não-comparecimento do aluno às atividades ora contratadas não exime o(a) CONTRATANTE do pagamento, ressalvadas as disposições específicas sobre ausência justificada (Cláusula 5ª, §4º).',
      ],
    },

    {
      type: 'h3',
      text: 'Cláusula 4ª: DO CANCELAMENTO (Rescisão por Iniciativa do Contratante)',
    },

    {
      type: 'p',
      children: [
        'O cancelamento ou a desistência dos serviços ora contratados deverá ser requerido formalmente, pelo e-mail matriculaklminasesportes@gmail.com ou via sistema KL Minas Esportes, até o dia 25 de cada mês, para que não haja cobrança da mensalidade do mês seguinte, sendo o dia 25 de outubro a data limite de cancelamento anual de Novembro e/ou Dezembro.',
      ],
    },

    {
      type: 'p',
      children: [
        'a) A falta de comunicação formal implica a sequência dos pagamentos das mensalidades uma vez que os custos dos serviços contratados já foram assumidos pela CONTRATADA e dependem de planejamento pedagógico prévio, reserva de vaga, organização de turmas/horários e escala de professores.',
      ],
    },

    {
      type: 'p',
      children: [
        '§1º A CONTRATADA se reserva o direito de extinguir ou alterar as condições do curso caso as modalidades esportivas não atinjam um número mínimo de 5(cinco) alunos por turma.',
      ],
    },

    {
      type: 'p',
      children: [
        '§2º A CONTRATADA se reserva o direito de cancelar o presente contrato, transferir o local da prestação de serviços ou, ainda, alterar o horário das atividades contratadas em função da realização de obras de alteração, manutenção ou ajuste dos locais destinados à referida prática.',
      ],
    },

    {
      type: 'h3',
      text: 'Cláusula 5ª: DAS AULAS E ABATIMENTO POR AUSÊNCIA JUSTIFICADA',
    },

    {
      type: 'p',
      children: [
        '§1º Em caso de chuvas ou indisponibilidade das quadras/sala, as aulas serão ministradas através de atividades alternativas, havendo adaptação do planejamento e local. Só haverá cancelamento de aulas em casos extremos, quando a ESCOLA DE ESPORTES julgar comprometida a segurança dos alunos.',
      ],
    },

    {
      type: 'p',
      children: [
        '§2º Os EVENTOS ESPORTIVOS DA ESCOLA DE ESPORTES serão computados como horas para compensação da carga horária dos dias do recesso de JULHO e DEZEMBRO, acrescido de taxa de participação para custos extras, caso houver. O não comparecimento do aluno no evento esportivo, não dará direito a reposição em outro dia ou desconto no valor da mensalidade.',
      ],
    },

    {
      type: 'p',
      children: [
        '§3º Caso os eventos não supram as horas totais a serem cumpridas dos recessos de JULHO e DEZEMBRO, serão oferecidas aulas extras em dias e horários diferenciado (AULÕES DE COMPENSAÇÃO) para cumprir a carga horária faltante, de acordo com a disponibilidade dos espaços do colégio e professores.',
      ],
    },

    {
      type: 'p',
      children: [
        '§4º A relação contratual é de consumo (CDC) e não se aplica qualquer regra de abono pré-fixado de dias por motivos de viagem, compromissos pessoais ou situações similares.',
      ],
    },

    {
      type: 'p',
      children: [
        'a) Em caso de ausência do aluno superior a 3 (três) dias úteis consecutivos por motivo de saúde devidamente comprovado por Atestado Médico, o CONTRATANTE terá direito ao abatimento proporcional no valor da mensalidade correspondente aos dias de aulas perdidas por conta do atestado, desde que a comunicação e apresentação do atestado sejam feitas em até 5 (cinco) dias úteis do início do afastamento. b) O abatimento será calculado dividindo o valor da mensalidade pelo número total de aulas previstas no mês e multiplicando pelo número de aulas perdidas em virtude do atestado. c) O pagamento da mensalidade integral é devido pela disponibilidade do serviço, exceto quando a ausência for prolongada e comprovada por atestado médico, conforme este parágrafo.',
      ],
    },

    {
      type: 'h3',
      text: 'Cláusula 6ª: DAS DISPOSIÇÕES GERAIS E OBRIGATORIEDADE DE ADITIVO',
    },

    {
      type: 'p',
      children: [
        '§1º - O CONTRATANTE declara e assume que o(a) aluno(a) está apto para a prática de atividades físicas contratadas. Caso o aluno possua condições médicas pré-existentes ou inaptidão, torna-se imprescindível a apresentação do Atestado Médico antes do início das atividades extracurriculares. A KL Minas Esportes se isenta de qualquer responsabilidade por acidentes ou lesões decorrentes de condições de saúde preexistentes não informadas ou da inobservância desta obrigação pelo CONTRATANTE.',
      ],
    },

    {
      type: 'p',
      children: [
        '§2º - O contratante concede gratuitamente à Escola de Esportes KL Minas o direito de suas imagens para divulgação da Escola de Esportes em fotos, redes sociais, folders, folhetos e propagandas de distribuição gratuita.',
      ],
    },

    {
      type: 'p',
      children: [
        '§3º OBRIGATORIEDADE DE ADITIVO CONTRATUAL: Qualquer alteração nas condições inicialmente pactuadas, incluindo, mas não se limitando a: a) Mudança de modalidade esportiva; b) Mudança na frequência semanal (dias e horários); c) Aderência de irmãos (inclusão de novos alunos); d) Inclusão de nova modalidade para o aluno já matriculado; Deverá ser formalizada obrigatoriamente através da celebração de ADITIVO CONTRATUAL (Anexo II), com a descrição otimizada e direta da movimentação, o qual deverá ser apreciado e assinado por ambas as partes, sob pena de a alteração não ser considerada válida. A formalização deverá ocorrer através do e-mail matriculaklminasesportes@gmail.com ou via sistema KL Minas Esportes.',
      ],
    },

    {
      type: 'h3',
      text: 'CLÁUSULA 7ª: DA VIGÊNCIA E RESCISÃO (por Iniciativa da Contratada)',
    },

    {
      type: 'p',
      children: [
        'O presente contrato terá sua vigência a contar da data de sua assinatura pelas partes até o final do ano letivo de 2026. Este poderá ser rescindido a qualquer tempo pelos seguintes motivos:: a) Por inadimplência superior a 60 (sessenta) dias do pagamento das obrigações financeiras junto a ESCOLA DE ESPORTES; b) Por ato de indisciplina grave, postura inadequada em relação a professores, funcionários ou colegas, desarmonia do aluno e/ou responsável com o regime ou filosofia do estabelecimento de ensino. c) Lesão à imagem ou ao patrimônio da ESCOLA DE ESPORTES, do colégio ou de terceiros. d) Por descumprimento ou cumprimento irregular de qualquer das cláusulas e obrigações previstas neste Instrumento, por qualquer das partes. O CONTRATANTE terá direito à restituição do valor correspondente às aulas não usufruídas do mês em curso.',
      ],
    },

    { type: 'h3', text: 'Cláusula 8ª: DA ASSINATURA E FORO' },

    {
      type: 'p',
      children: [
        'As partes elegem o foro desta Capital, Belo Horizonte/MG, para dirimir controvérsias oriundas deste contrato.',
      ],
    },

    {
      type: 'p',
      children: [
        'Parágrafo Único - Obrigatoriedade de Assinatura: O presente Instrumento, bem como todos os seus Aditivos Contratuais, deverão ser assinados pelas partes, de forma digital, para terem plena validade e eficácia.',
      ],
    },

    { type: 'date' },
    { type: 'signatures' },
  ];
};
