// Em: src/features/contracts/ConsolidatedValuesTable.tsx

import { formatCurrency } from '../../lib/formatters';
import { ContractSessionData } from '../../types';

interface ConsolidatedValuesTableProps {
  data: ContractSessionData;
}

export function ConsolidatedValuesTable({
  data,
}: ConsolidatedValuesTableProps) {
  // Cores e estilos para consistência, especialmente para o PDF
  const styles = {
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '12px',
      color: '#333', // Um cinza escuro para o texto
    },
    th: {
      backgroundColor: '#4a4a4a', // Cinza escuro para o cabeçalho
      color: '#ffffff',
      padding: '8px',
      textAlign: 'left' as const,
      border: '1px solid #666',
    },
    td: {
      padding: '8px',
      border: '1px solid #666',
      verticalAlign: 'middle' as const,
    },
    tdRight: {
      padding: '8px',
      border: '1px solid #666',
      textAlign: 'right' as const,
      verticalAlign: 'middle' as const,
    },
    totalRow: {
      backgroundColor: '#e0e0e0', // Um cinza claro para as linhas de total
      fontWeight: 'bold' as const,
    },
  };

  return (
    <div className="w-full my-6 avoid-page-break">
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Nome do(s) Aluno(s)</th>
            <th style={styles.th}>Modalidade</th>
            <th style={styles.th}>Data de Início</th>
            <th style={styles.th}>Data de Término</th>
            <th style={{ ...styles.th, textAlign: 'right' as const }}>
              Valor Integral
            </th>
            <th style={{ ...styles.th, textAlign: 'right' as const }}>
              Valor com Desconto
            </th>
            <th style={styles.th}>Motivo do Desconto</th>
          </tr>
        </thead>
        <tbody>
          {/* Itera sobre cada inscrição de cada aluno */}
          {data.subscriptionItems
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map((item, index) => (
              <tr key={index}>
                <td style={styles.td}>{item.studentName.toUpperCase()}</td>
                <td style={styles.td}>{item.courseName.toUpperCase()}</td>
                <td style={styles.td}>{item.startDate}</td>
                <td style={styles.td}>{item.endDate}</td>
                <td style={styles.tdRight}>{formatCurrency(item.fullPrice)}</td>
                <td style={styles.tdRight}>
                  {formatCurrency(item.appliedPrice)}
                </td>
                <td style={styles.td}>{item.discountReason}</td>
              </tr>
            ))}

          {/* Linha da Taxa de Matrícula */}
          <tr style={styles.totalRow}>
            <td
              colSpan={6}
              style={{ ...styles.td, textAlign: 'right' as const }}
            >
              TAXA DE MATRÍCULA
            </td>
            <td style={styles.tdRight}>{formatCurrency(data.enrollmentFee)}</td>
          </tr>

          {/* Linha do Total Mensalidade Integral */}
          <tr style={styles.totalRow}>
            <td
              colSpan={6}
              style={{ ...styles.td, textAlign: 'right' as const }}
            >
              TOTAL MENSALIDADE INTEGRAL
            </td>
            <td style={styles.tdRight}>
              {formatCurrency(data.totalFullPrice)}
            </td>
          </tr>

          {/* Linha do Total Mensalidade com Descontos */}
          <tr style={styles.totalRow}>
            <td
              colSpan={6}
              style={{ ...styles.td, textAlign: 'right' as const }}
            >
              TOTAL MENSALIDADE COM DESCONTOS
            </td>
            <td style={styles.tdRight}>
              {formatCurrency(data.totalAppliedPrice)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
