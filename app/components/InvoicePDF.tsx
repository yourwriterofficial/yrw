import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { AdminOrderView, InvoiceType } from '@/lib/types';

Font.register({ family: 'Inter', src: 'https://fonts.googleapis.com/css2?family=Inter' });

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#ffffff', fontFamily: 'Inter' },
  header: { marginBottom: 30, borderBottom: '1px solid #1DB954', paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1DB954' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  value: { fontSize: 10, color: '#555' },
  total: { marginTop: 20, paddingTop: 10, borderTop: '1px solid #ddd', flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 14, fontWeight: 'bold' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#1DB954' },
});

interface InvoicePDFProps {
  order: AdminOrderView;
  amount: number;
  type: InvoiceType;
}

export const InvoicePDF = ({ order, amount, type }: InvoicePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>YourWriterOfficial</Text>
        <Text style={styles.subtitle}>Official Invoice</Text>
      </View>
      <View>
        <View style={styles.row}>
          <Text style={styles.label}>Order ID:</Text>
          <Text style={styles.value}>{order['Order ID']}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Client:</Text>
          <Text style={styles.value}>{order['Legal Name']}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{order['Email']}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Invoice Type:</Text>
          <Text style={styles.value}>{type === 'DEPOSIT' ? '60% Deposit' : '40% Balance'}</Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Amount Due:</Text>
          <Text style={styles.totalValue}>₦{amount.toLocaleString()}</Text>
        </View>
      </View>
    </Page>
  </Document>
);