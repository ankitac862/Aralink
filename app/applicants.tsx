import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, FlatList, ListRenderItem, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
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
  const { user } = useAuthStore();
  const [applicants, setApplicants] = useState<ApplicantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    <TouchableOpacity style={[styles.card, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
      <ThemedText type="subtitle">{item.applicant_name}</ThemedText>
      <ThemedText style={styles.text}>{item.applicant_email}</ThemedText>
      <ThemedText style={styles.text}>{item.property_address}</ThemedText>
      <ThemedText style={[styles.status, { color: statusColor(item.status) }]}>
        {item.status.replace('_', ' ').toUpperCase()}
      </ThemedText>
      <ThemedText style={[styles.text, { fontSize: 12 }]}>
        Applied: {new Date(item.submitted_at).toLocaleDateString()}
      </ThemedText>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} style={{ marginTop: 50 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">New Applicants</ThemedText>
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={() => router.push('/add-applicant')}>
            <ThemedText style={styles.btnText}>+ Invite Applicant</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        
        {applicants.length === 0 ? (
          <ThemedText style={[styles.text, { textAlign: 'center', marginTop: 20 }]}>
            No applications yet. Invite applicants to get started.
          </ThemedText>
        ) : (
          <FlatList
            data={applicants}
            keyExtractor={(i) => i.id}
            renderItem={renderApplicant}
            scrollEnabled={false}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, gap: 12 },
  btn: { padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  text: { marginTop: 4, fontSize: 14 },
  status: { marginTop: 8, fontWeight: 'bold' },
});
