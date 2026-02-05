import { Platform, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { DbTransaction } from '@/lib/supabase';

/**
 * Export transactions to CSV (Excel-compatible)
 * Works on iOS, Android, and Web
 */
export async function exportTransactionsToExcel(
  transactions: DbTransaction[],
  tenantName: string
): Promise<void> {
  try {
    // Generate CSV content
    const csvHeader = 'Date,Category,Type,Amount,Status,Description\n';
    const csvRows = transactions.map(t => {
      const date = new Date(t.date).toLocaleDateString('en-US');
      const amount = t.amount.toFixed(2);
      const description = (t.description || '').replace(/,/g, ';'); // Escape commas
      return `${date},${t.category},${t.type},${amount},${t.status},"${description}"`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    const fileName = `${tenantName.replace(/\s+/g, '_')}_Ledger_${new Date().toISOString().split('T')[0]}.csv`;

    if (Platform.OS === 'web') {
      // Web: Download via blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      Alert.alert('Success', 'Ledger exported successfully');
    } else {
      // Mobile: Save and share using React Native Share API
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Use React Native's built-in Share API
      const shareOptions = Platform.select({
        ios: {
          url: fileUri,
          subject: `Ledger Export - ${tenantName}`,
        },
        android: {
          title: 'Export Ledger',
          message: `Ledger export for ${tenantName}`,
          url: fileUri,
        },
      });

      try {
        const result = await Share.share(shareOptions || { message: csvContent });
        if (result.action === Share.sharedAction) {
          Alert.alert('Success', 'Ledger exported successfully');
        }
      } catch (shareError) {
        // Fallback: Just show the file path
        Alert.alert('Success', `Ledger saved to ${fileUri}`);
      }
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    Alert.alert('Error', 'Failed to export ledger. Please try again.');
  }
}
