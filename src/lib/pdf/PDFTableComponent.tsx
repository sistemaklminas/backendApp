// Em: src/lib/pdf/PDFTableComponent.tsx

import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { ContractSessionData } from '../../types';
import { formatCurrency } from '../firestoreApi';

const tableStyles = StyleSheet.create({
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    border: '1px solid #666',
    marginVertical: 12,
    fontSize: 9,
  },
  tableRow: { flexDirection: 'row', borderTop: '1px solid #666' },
  tableColHeader: {
    width: '14.28%',
    backgroundColor: '#4a4a4a',
    color: '#fff',
    padding: 4,
    borderLeft: '1px solid #666',
  },
  tableCol: { width: '14.28%', padding: 4, borderLeft: '1px solid #666' },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    fontWeight: 'bold',
    borderTop: '1px solid #666',
  },
  totalColLabel: { width: '85.72%', padding: 4, textAlign: 'right' },
  totalColValue: {
    width: '14.28%',
    padding: 4,
    textAlign: 'right',
    borderLeft: '1px solid #666',
  },
});

export function PDFTableComponent({ data }: { data: ContractSessionData }) {
  return (
    <View style={tableStyles.table}>
      <View style={{ ...tableStyles.tableRow, borderTop: 0 }}>
        <Text
          style={{ ...tableStyles.tableColHeader, width: '20%', borderLeft: 0 }}
        >
          Aluno(s)
        </Text>
        <Text style={{ ...tableStyles.tableColHeader, width: '15%' }}>
          Modalidade
        </Text>
        <Text style={{ ...tableStyles.tableColHeader, width: '12%' }}>
          Início
        </Text>
        <Text style={{ ...tableStyles.tableColHeader, width: '12%' }}>
          Término
        </Text>
        <Text
          style={{
            ...tableStyles.tableColHeader,
            width: '13%',
            textAlign: 'right',
          }}
        >
          V. Integral
        </Text>
        <Text
          style={{
            ...tableStyles.tableColHeader,
            width: '13%',
            textAlign: 'right',
          }}
        >
          V. Desconto
        </Text>
        <Text style={{ ...tableStyles.tableColHeader, width: '15%' }}>
          Motivo
        </Text>
      </View>
      {data.subscriptionItems.map((item, index) => (
        <View
          key={index}
          style={tableStyles.tableRow}
        >
          <Text
            style={{ ...tableStyles.tableCol, width: '20%', borderLeft: 0 }}
          >
            {item.studentName.toUpperCase()}
          </Text>
          <Text style={{ ...tableStyles.tableCol, width: '15%' }}>
            {item.courseName.toUpperCase()}
          </Text>
          <Text style={{ ...tableStyles.tableCol, width: '12%' }}>
            {item.startDate}
          </Text>
          <Text style={{ ...tableStyles.tableCol, width: '12%' }}>
            {item.endDate}
          </Text>
          <Text
            style={{
              ...tableStyles.tableCol,
              width: '13%',
              textAlign: 'right',
            }}
          >
            {formatCurrency(item.fullPrice)}
          </Text>
          <Text
            style={{
              ...tableStyles.tableCol,
              width: '13%',
              textAlign: 'right',
            }}
          >
            {formatCurrency(item.appliedPrice)}
          </Text>
          <Text style={{ ...tableStyles.tableCol, width: '15%' }}>
            {item.discountReason}
          </Text>
        </View>
      ))}
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalColLabel}>TAXA DE MATRÍCULA</Text>
        <Text style={tableStyles.totalColValue}>
          {formatCurrency(data.enrollmentFee)}
        </Text>
      </View>
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalColLabel}>
          TOTAL MENSALIDADE INTEGRAL
        </Text>
        <Text style={tableStyles.totalColValue}>
          {formatCurrency(data.totalFullPrice)}
        </Text>
      </View>
      <View style={tableStyles.totalRow}>
        <Text style={tableStyles.totalColLabel}>
          TOTAL MENSALIDADE COM DESCONTOS
        </Text>
        <Text style={tableStyles.totalColValue}>
          {formatCurrency(data.totalAppliedPrice)}
        </Text>
      </View>
    </View>
  );
}
