import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, FlatList, ListRenderItem, ActivityIndicator, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/store/authStore';
import { fetchLandlordApplications } from '@/lib/supabase';

interface ApplicantItem {
  id: string;
  applicant_name: string;
  applicant_email: string;
  property_address: string;
  status: string;
  submitted_at: string;
}

export default function ApplicantsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [applicants, setApplicants] = useState<ApplicantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isDark = colorScheme === 'dark';
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const cardBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#0d141b';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const loadApplications = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    const apps = await fetchLandlordApplications(user.id);
    
    const formattedApps = apps.map((app: any) => {
      const property = app.properties;
      const propertyAddress = property ? 
        `${property.address1}, ${property.city}` : 
        'Unknown Property';
      
      return {
        id: app.id,
        applicant_name: app.applicant_name,
        applicant_email: app.applicant_email,
        property_address: propertyAddress,
        status: app.status,
        submitted_at: app.submitted_at,
      };
    });
    
    setApplicants(formattedApps);
    setIsLoading(false);
  };

  // Refresh applications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadApplications();
    }, [user?.id])
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#f44336';
      case 'under_review': return '#FF9800';
      case 'submitted': return '#2196F3';
      default: return '#2196F3';
    }
  };

  const renderApplicant: ListRenderItem<ApplicantItem> = ({ item }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
      <ThemedText type="subtitle" style={{ color: textColor }}>{item.applicant_name}</ThemedText>
      <ThemedText style={[styles.text, { color: secondaryTextColor }]}>{item.applicant_email}</ThemedText>
      <ThemedText style={[styles.text, { color: secondaryTextColor }]}>{item.property_address}</ThemedText>
      <ThemedText style={[styles.status, { color: statusColor(item.status) }]}>
        {item.status.replace('_', ' ').toUpperCase()}
      </ThemedText>
      <ThemedText style={[styles.text, { fontSize: 12, color: secondaryTextColor }]}>
        Applied: {new Date(item.submitted_at).toLocaleDateString()}
      </ThemedText>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
        <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 50 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          New Applicants
        </ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
        {applicants.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="inbox-outline" size={64} color={secondaryTextColor} />
            <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
              No applications yet
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: secondaryTextColor }]}>
              Invite applicants to get started
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={applicants}
            keyExtractor={(i) => i.id}
            renderItem={renderApplicant}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: primaryColor }]}
        onPress={() => router.push('/add-applicant')}>
        <MaterialCommunityIcons name="plus" size={28} color="white" />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  text: {
    marginTop: 4,
    fontSize: 14,
  },
  status: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#137fec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
