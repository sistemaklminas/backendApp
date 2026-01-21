// Em: src/features/contracts/ContractPDFDocument.tsx

import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
// --- IMPORTE OS NOVOS TIPOS E COMPONENTES ---
import type { ContractSessionData } from '../../types';
import { getContractContent } from './contractContent';
import { PDFTableComponent } from './PDFTableComponent';

// --- ATUALIZE A PROP 'data' ---
interface ContractPDFDocumentProps {
  data: ContractSessionData;
}

// --- REGISTRO DE FONTES (MUITO IMPORTANTE PARA O PDF) ---
// Se ainda não tiver, adicione. Se já tiver, verifique se está correto.
// Baixe as fontes do Google Fonts (Arial) e coloque na pasta /public/fonts
Font.register({
  family: 'Arial',
  fonts: [
    { src: '/fonts/arial.ttf' },
    { src: '/fonts/arial-bold.ttf', fontWeight: 'bold' },
  ],
});

// --- ESTILOS PARA O PDF ---
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Arial',
    fontSize: 10,
    padding: '40px 50px',
    lineHeight: 1.5,
    color: '#333',
  },
  h1: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  h2: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  h3: { fontSize: 11, fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  p: { textAlign: 'justify', marginBottom: 8 },
  bold: { fontWeight: 'bold' },
  date: { marginTop: 32, textAlign: 'center' },
  signatures: {
    marginTop: 64,
    paddingTop: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBlock: { width: '45%', textAlign: 'center' },
  signatureLine: {
    borderTop: '1px solid #333',
    width: '80%',
    margin: '0 auto',
    paddingTop: 4,
  },
});

// --- COMPONENTE PDF ATUALIZADO ---
export function ContractPDFDocument({ data }: ContractPDFDocumentProps) {
  const { financialResponsible: resp, year } = data;
  const content = getContractContent(data, year);

  return (
    <Document title={`Contrato KL Minas - ${resp.name}`}>
      <Page
        size="A4"
        style={styles.page}
      >
        {content.map((block, index) => {
          switch (block.type) {
            case 'h1':
              return (
                <Text
                  key={index}
                  style={styles.h1}
                >
                  {block.text}
                </Text>
              );
            case 'h2':
              return (
                <Text
                  key={index}
                  style={styles.h2}
                >
                  {block.text}
                </Text>
              );
            case 'h3':
              return (
                <Text
                  key={index}
                  style={styles.h3}
                >
                  {block.text}
                </Text>
              );
            case 'p':
              return (
                <Text
                  key={index}
                  style={styles.p}
                >
                  {block.children.map((child, i) =>
                    typeof child === 'string' ? (
                      child
                    ) : (
                      <Text
                        key={i}
                        style={styles.bold}
                      >
                        {child.text}
                      </Text>
                    ),
                  )}
                </Text>
              );
            case 'table':
              // O componente da tabela não pode ser usado diretamente aqui.
              // Precisamos recriar sua estrutura com os componentes do react-pdf.
              // A melhor abordagem é passar os dados para um componente PDF específico.
              return (
                <PDFTableComponent
                  key={index}
                  data={data}
                />
              );
            case 'date':
              return (
                <Text
                  key={index}
                  style={styles.date}
                >
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
                <View
                  key={index}
                  style={styles.signatures}
                >
                  <View style={styles.signatureBlock}>
                    <View style={styles.signatureLine}>
                      <Text style={styles.bold}>{resp.name.toUpperCase()}</Text>
                      <Text>Contratante (CPF: {resp.document})</Text>
                    </View>
                  </View>
                  <View style={styles.signatureBlock}>
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

// // --- COMPONENTE AUXILIAR PARA A TABELA DENTRO DO PDF ---
// // Não podemos usar HTML/divs, temos que usar os componentes do react-pdf
// function PDFTableComponent({ data }: { data: ContractSessionData }) {
//   const tableStyles = StyleSheet.create({
//     table: {
//       display: 'flex',
//       flexDirection: 'column',
//       width: 'auto',
//       border: '1px solid #666',
//       marginVertical: 12,
//     },
//     tableRow: { flexDirection: 'row' },
//     tableColHeader: {
//       width: '14.28%',
//       backgroundColor: '#4a4a4a',
//       color: '#fff',
//       padding: 4,
//       border: '1px solid #666',
//     },
//     tableCol: { width: '14.28%', padding: 4, border: '1px solid #666' },
//     totalRow: {
//       flexDirection: 'row',
//       backgroundColor: '#e0e0e0',
//       fontWeight: 'bold',
//     },
//     totalColLabel: {
//       width: '85.72%',
//       padding: 4,
//       border: '1px solid #666',
//       textAlign: 'right',
//     },
//     totalColValue: {
//       width: '14.28%',
//       padding: 4,
//       border: '1px solid #666',
//       textAlign: 'right',
//     },
//   });

//   return (
//     <View style={tableStyles.table}>
//       {/* Cabeçalho */}
//       <View style={tableStyles.tableRow}>
//         <Text style={{ ...tableStyles.tableColHeader, width: '20%' }}>
//           Aluno(s)
//         </Text>
//         <Text style={{ ...tableStyles.tableColHeader, width: '15%' }}>
//           Modalidade
//         </Text>
//         <Text style={{ ...tableStyles.tableColHeader, width: '12%' }}>
//           Início
//         </Text>
//         <Text style={{ ...tableStyles.tableColHeader, width: '12%' }}>
//           Término
//         </Text>
//         <Text
//           style={{
//             ...tableStyles.tableColHeader,
//             width: '13%',
//             textAlign: 'right',
//           }}
//         >
//           V. Integral
//         </Text>
//         <Text
//           style={{
//             ...tableStyles.tableColHeader,
//             width: '13%',
//             textAlign: 'right',
//           }}
//         >
//           V. Desconto
//         </Text>
//         <Text style={{ ...tableStyles.tableColHeader, width: '15%' }}>
//           Motivo
//         </Text>
//       </View>
//       {/* Itens */}
//       {data.subscriptionItems.map((item, index) => (
//         <View
//           key={index}
//           style={tableStyles.tableRow}
//         >
//           <Text style={{ ...tableStyles.tableCol, width: '20%' }}>
//             {item.studentName.toUpperCase()}
//           </Text>
//           <Text style={{ ...tableStyles.tableCol, width: '15%' }}>
//             {item.courseName.toUpperCase()}
//           </Text>
//           <Text style={{ ...tableStyles.tableCol, width: '12%' }}>
//             {item.startDate}
//           </Text>
//           <Text style={{ ...tableStyles.tableCol, width: '12%' }}>
//             {item.endDate}
//           </Text>
//           <Text
//             style={{
//               ...tableStyles.tableCol,
//               width: '13%',
//               textAlign: 'right',
//             }}
//           >
//             {formatCurrency(item.fullPrice)}
//           </Text>
//           <Text
//             style={{
//               ...tableStyles.tableCol,
//               width: '13%',
//               textAlign: 'right',
//             }}
//           >
//             {formatCurrency(item.appliedPrice)}
//           </Text>
//           <Text style={{ ...tableStyles.tableCol, width: '15%' }}>
//             {item.discountReason}
//           </Text>
//         </View>
//       ))}
//       {/* Totais */}
//       <View style={tableStyles.totalRow}>
//         <Text style={tableStyles.totalColLabel}>TAXA DE MATRÍCULA</Text>
//         <Text style={tableStyles.totalColValue}>
//           {formatCurrency(data.enrollmentFee)}
//         </Text>
//       </View>
//       <View style={tableStyles.totalRow}>
//         <Text style={tableStyles.totalColLabel}>
//           TOTAL MENSALIDADE INTEGRAL
//         </Text>
//         <Text style={tableStyles.totalColValue}>
//           {formatCurrency(data.totalFullPrice)}
//         </Text>
//       </View>
//       <View style={tableStyles.totalRow}>
//         <Text style={tableStyles.totalColLabel}>
//           TOTAL MENSALIDADE COM DESCONTOS
//         </Text>
//         <Text style={tableStyles.totalColValue}>
//           {formatCurrency(data.totalAppliedPrice)}
//         </Text>
//       </View>
//     </View>
//   );
// }
