import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import fs from 'node:fs';
import path from 'node:path';
import type { AddendumSessionData } from '../../types';
import { getAddendumContent } from './addendumContent';
import { formatCurrency } from '../firestoreApi';

interface AddendumPDFDocumentProps {
  data: AddendumSessionData;
}

const resolveFontPath = (filename: string): string | null => {
  const candidates = [
    path.resolve(process.cwd(), '../public/fonts', filename),
    path.resolve(process.cwd(), 'public/fonts', filename),
    path.resolve(__dirname, '../../../../public/fonts', filename),
    path.resolve(__dirname, '../../../public/fonts', filename),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found || null;
};

const arialRegular = resolveFontPath('arial.ttf');
const arialBold = resolveFontPath('arial-bold.ttf');
const PDF_FONT_FAMILY = arialRegular && arialBold ? 'Arial' : 'Helvetica';

if (arialRegular && arialBold) {
  Font.register({
    family: 'Arial',
    fonts: [
      { src: arialRegular },
      { src: arialBold, fontWeight: 'bold' },
    ],
  });
} else {
  console.warn(
    '[AddendumPDFDocument] Fontes Arial não encontradas. Usando Helvetica como fallback.',
  );
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    padding: '40px 50px',
    lineHeight: 1.5,
    color: '#333',
  },
  h1: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  h3: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  p: { textAlign: 'justify', marginBottom: 8 },
  bold: { fontWeight: 'bold' },
  date: { marginTop: 24, textAlign: 'center' },
  signatures: {
    marginTop: 48,
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBlock: { width: '45%', textAlign: 'center' },
  anchorHidden: {
    fontSize: 0.5,
    color: '#ffffff',
    marginBottom: 2,
  },
  signatureLine: {
    borderTop: '1px solid #333',
    width: '80%',
    margin: '0 auto',
    paddingTop: 4,
  },
  checklistItem: {
    marginBottom: 4,
  },
});

export function AddendumPDFDocument({ data }: AddendumPDFDocumentProps) {
  const content = getAddendumContent(data);
  const { financialResponsible: resp } = data;

  return (
    <Document title={`Aditivo KL Minas - ${resp.name}`}>
      <Page size="A4" style={styles.page}>
        {content.map((block, index) => {
          switch (block.type) {
            case 'h1':
              return (
                <Text key={index} style={styles.h1}>
                  {block.text}
                </Text>
              );
            case 'h3':
              return (
                <Text key={index} style={styles.h3}>
                  {block.text}
                </Text>
              );
            case 'p':
              return (
                <Text key={index} style={styles.p}>
                  {block.children.map((child, i) =>
                    typeof child === 'string' ? (
                      child
                    ) : (
                      <Text key={i} style={styles.bold}>
                        {child.text}
                      </Text>
                    ),
                  )}
                </Text>
              );
            case 'reasonChecklist':
              return <PDFReasonChecklist key={index} data={data} />;
            case 'table':
              return <PDFAddendumTable key={index} data={data} />;
            case 'date':
              return (
                <Text key={index} style={styles.date}>
                  Belo Horizonte,{' '}
                  {new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                  .
                </Text>
              );
            case 'signatures':
              return (
                <View key={index} style={styles.signatures}>
                  <View style={styles.signatureBlock}>
                    <Text style={styles.anchorHidden}>{'<<signer_parent>>'}</Text>
                    <View style={styles.signatureLine}>
                      <Text style={styles.bold}>
                        {resp.name.toUpperCase()}
                      </Text>
                      <Text>Contratante (CPF: {resp.document})</Text>
                    </View>
                  </View>
                  <View style={styles.signatureBlock}>
                    <Text style={styles.anchorHidden}>{'<<signer_school>>'}</Text>
                    <View style={styles.signatureLine}>
                      <Text style={styles.bold}>KL Minas Esportes LTDA</Text>
                      <Text>Contratada (CNPJ 13.839.322/0001-70)</Text>
                    </View>
                  </View>
                </View>
              );
            default:
              return null;
          }
        })}
      </Page>
    </Document>
  );
}

function PDFReasonChecklist({ data }: { data: AddendumSessionData }) {
  const reason = data.reason;
  const items = [
    { key: 'MODALITY_CHANGE', label: 'Mudança de modalidade esportiva' },
    { key: 'FREQUENCY_CHANGE', label: 'Alteração na frequência semanal' },
    { key: 'SIBLING_ADDED', label: 'Inclusão de irmão/novo aluno' },
    { key: 'NEW_MODALITY_ADDED', label: 'Inclusão de nova modalidade para aluno já matriculado' },
    { key: 'MODALITY_REMOVED', label: 'Exclusão de modalidade com continuidade de contrato por outra modalidade' },
    { key: 'OTHER', label: 'Outros:' },
  ] as const;

  return (
    <View>
      {items.map((item) => {
        const isChecked = reason.type === item.key;
        const suffix = item.key === 'OTHER'
          ? ` ${reason.type === 'OTHER' ? reason.description : '___________________________________________'}`
          : '';
        return (
          <Text key={item.key} style={styles.checklistItem}>
            ({isChecked ? 'X' : ' '}) {item.label}{suffix}
          </Text>
        );
      })}
    </View>
  );
}

function PDFAddendumTable({ data }: { data: AddendumSessionData }) {
  const tableStyles = StyleSheet.create({
    table: {
      display: 'flex',
      flexDirection: 'column',
      width: 'auto',
      border: '1px solid #666',
      marginVertical: 12,
    },
    row: { flexDirection: 'row' },
    colHeader: {
      backgroundColor: '#4a4a4a',
      color: '#fff',
      padding: 4,
      border: '1px solid #666',
      fontSize: 9,
    },
    col: {
      padding: 4,
      border: '1px solid #666',
      fontSize: 9,
    },
    totalRow: {
      flexDirection: 'row',
      backgroundColor: '#e0e0e0',
      fontWeight: 'bold',
    },
    totalLabel: {
      width: '70%',
      padding: 4,
      border: '1px solid #666',
      textAlign: 'right',
      fontSize: 9,
    },
    totalValue: {
      width: '30%',
      padding: 4,
      border: '1px solid #666',
      textAlign: 'right',
      fontSize: 9,
    },
  });

  const headers = [
    { label: 'Nome do(s) Aluno(s)', width: '22%' },
    { label: 'Modalidade', width: '18%' },
    { label: 'Data de Início', width: '12%' },
    { label: 'Data de Término', width: '12%' },
    { label: 'Valor Integral', width: '12%' },
    { label: 'Valor com Desconto', width: '14%' },
    { label: 'Motivo', width: '10%' },
  ];

  return (
    <View style={tableStyles.table}>
      <View style={tableStyles.row}>
        {headers.map((h) => (
          <Text key={h.label} style={{ ...tableStyles.colHeader, width: h.width }}>
            {h.label}
          </Text>
        ))}
      </View>

      {data.subscriptionItems.map((item, idx) => (
        <View key={`${item.studentName}-${idx}`} style={tableStyles.row}>
          <Text style={{ ...tableStyles.col, width: headers[0].width }}>
            {item.studentName}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[1].width }}>
            {item.courseName}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[2].width }}>
            {item.startDate}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[3].width }}>
            {item.endDate}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[4].width, textAlign: 'right' }}>
            {formatCurrency(item.fullPrice)}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[5].width, textAlign: 'right' }}>
            {formatCurrency(item.appliedPrice)}
          </Text>
          <Text style={{ ...tableStyles.col, width: headers[6].width }}>
            {item.discountReason}
          </Text>
        </View>
      ))}

      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalLabel}>TAXA DE MATRÍCULA EFETIVADA NO CONTRATO ORIGINAL</Text>
        <Text style={tableStyles.totalValue}>{formatCurrency(data.enrollmentFeeOriginal)}</Text>
      </View>
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalLabel}>DIFERENÇA DA TAXA DE MATRÍCULA APÓS ADITIVO CONTRATUAL</Text>
        <Text style={tableStyles.totalValue}>{formatCurrency(data.enrollmentFeeDifference)}</Text>
      </View>
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalLabel}>TOTAL MENSALIDADE INTEGRAL</Text>
        <Text style={tableStyles.totalValue}>{formatCurrency(data.totalFullPrice)}</Text>
      </View>
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalLabel}>TOTAL MENSALIDADE COM DESCONTOS</Text>
        <Text style={tableStyles.totalValue}>{formatCurrency(data.totalAppliedPrice)}</Text>
      </View>
    </View>
  );
}
