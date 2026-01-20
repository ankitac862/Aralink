import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  FlatList,
  ListRenderItem,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Announcement {
  id: string;
  icon: string;
  title: string;
  description: string;
  date: string;
}

interface QuickLink {
  id: string;
  icon: string;
  label: string;
  route: string;
}

export default function TenantDashboardScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isDark = colorScheme === 'dark';
  const primaryColor = '#4A90E2';
  const bgColor = isDark ? '#101922' : '#F4F6F8';
  const cardBgColor = isDark ? '#192734' : '#ffffff';
  const textPrimaryColor = isDark ? '#F4F6F8' : '#1D1D1F';
  const textSecondaryColor = isDark ? '#8A8A8F' : '#8A8A8F';
  const warningColor = '#F5A623';

  const announcements: Announcement[] = [
    {
      id: '1',
      icon: 'pool',
      title: 'Pool Maintenance This Friday',
      description:
        'The community pool will be closed for scheduled maintenance this Friday, June 28th.',
      date: 'June 24, 2024',
    },
    {
      id: '2',
      icon: 'bug',
      title: 'Pest Control Notice',
      description:
        'Quarterly pest control service is scheduled for all units next Monday. Please prepare accordingly.',
      date: 'June 22, 2024',
    },
  ];

  const quickLinks: QuickLink[] = [
    { id: '1', icon: 'file-document-outline', label: 'View Lease', route: '/(tabs)/documents' },
    { id: '2', icon: 'account-supervisor', label: 'Contact Us', route: '/(tabs)/messages' },
    { id: '3', icon: 'folder-open', label: 'Documents', route: '/(tabs)/documents' },
    { id: '4', icon: 'gavel', label: 'Community Rules', route: '/(tabs)/explore' },
  ];

  const renderAnnouncement: ListRenderItem<Announcement> = ({ item }) => (
    <View
      style={[
        styles.announcementCard,
        {
          backgroundColor: cardBgColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.05,
          shadowRadius: 4,
        },
      ]}>
      <View
        style={[
          styles.announcementIconContainer,
          { backgroundColor: `${primaryColor}33` },
        ]}>
        <MaterialCommunityIcons name={item.icon as any} size={24} color={primaryColor} />
      </View>
      <View style={styles.announcementContent}>
        <ThemedText style={[styles.announcementTitle, { color: textPrimaryColor }]}>
          {item.title}
        </ThemedText>
        <ThemedText
          style={[styles.announcementDescription, { color: textSecondaryColor }]}>
          {item.description}
        </ThemedText>
        <ThemedText
          style={[styles.announcementDate, { color: textSecondaryColor, opacity: 0.7 }]}>
          {item.date}
        </ThemedText>
      </View>
    </View>
  );

  const renderQuickLink: ListRenderItem<QuickLink> = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.quickLinkCard,
        { backgroundColor: `${primaryColor}20` },
      ]}
      onPress={() => router.push(item.route as any)}>
      <View style={[styles.quickLinkIconContainer, { backgroundColor: `${primaryColor}40` }]}>
        <MaterialCommunityIcons name={item.icon as any} size={24} color={primaryColor} />
      </View>
      <ThemedText style={[styles.quickLinkLabel, { color: textPrimaryColor }]}>
        {item.label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: bgColor,
            paddingTop: insets.top + 8,
            paddingBottom: 12,
          },
        ]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => router.push('/profile')}>
            <View style={styles.profilePicture}>
              <MaterialCommunityIcons name="account" size={24} color={primaryColor} />
            </View>
            <View>
              <ThemedText style={[styles.greeting, { color: textPrimaryColor }]}>
                Hello, John
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Property Card */}
        <TouchableOpacity
          style={[
            styles.propertyCard,
            {
              backgroundColor: cardBgColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 4,
            },
          ]}
          onPress={() => router.push('/profile')}>
          <View
            style={[
              styles.propertyImagePlaceholder,
              { backgroundColor: `${primaryColor}30` },
            ]}>
            <MaterialCommunityIcons name="home" size={48} color={primaryColor} />
          </View>
          <View style={styles.propertyInfo}>
            <ThemedText style={[styles.propertyLabel, { color: textSecondaryColor }]}>
              YOUR HOME
            </ThemedText>
            <ThemedText style={[styles.propertyAddress, { color: textPrimaryColor }]}>
              123 Main Street, Apt 4B
            </ThemedText>
            <ThemedText style={[styles.propertyCity, { color: textSecondaryColor }]}>
              Springfield, IL 62704
            </ThemedText>
          </View>
        </TouchableOpacity>

        {/* Rent Status Card */}
        <View
          style={[
            styles.rentStatusCard,
            {
              backgroundColor: cardBgColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.2 : 0.05,
              shadowRadius: 4,
            },
          ]}>
          <View style={styles.rentStatusHeader}>
            <ThemedText style={[styles.rentStatusLabel, { color: textSecondaryColor }]}>
              RENT STATUS
            </ThemedText>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: warningColor }]} />
              <ThemedText style={[styles.statusText, { color: textPrimaryColor }]}>
                Rent is Due Soon
              </ThemedText>
            </View>
          </View>
          <View style={styles.rentStatusContent}>
            <ThemedText style={[styles.rentAmount, { color: textSecondaryColor }]}>
              $1,200.00 due on July 1st
            </ThemedText>
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: primaryColor }]}
              onPress={() => router.push('/(tabs)/index')}>
              <ThemedText style={styles.payButtonText}>Pay Now</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start Application Button */}
        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: primaryColor, marginBottom: 12 }]}
          onPress={() => router.push('/tenant-lease-start')}>
          <View style={styles.maintenanceButtonIcon}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#fff" />
          </View>
          <ThemedText style={styles.maintenanceButtonText}>Start Application</ThemedText>
        </TouchableOpacity>

        {/* Maintenance Request Button */}
        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: primaryColor }]}
          onPress={() => router.push('/tenant-maintenance-request')}>
          <View style={styles.maintenanceButtonIcon}>
            <MaterialCommunityIcons name="wrench" size={20} color="#fff" />
          </View>
          <ThemedText style={styles.maintenanceButtonText}>Submit Maintenance Request</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.maintenanceButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: primaryColor }]}
          onPress={() => router.push('/tenant-maintenance-status')}>
          <View style={[styles.maintenanceButtonIcon, { backgroundColor: primaryColor + '20' }]}>
            <MaterialCommunityIcons name="clipboard-text" size={20} color={primaryColor} />
          </View>
          <ThemedText style={[styles.maintenanceButtonText, { color: primaryColor }]}>View My Requests</ThemedText>
        </TouchableOpacity>

        {/* Quick Links */}
        <View>
          <FlatList
            data={quickLinks}
            keyExtractor={(item) => item.id}
            renderItem={renderQuickLink}
            numColumns={4}
            scrollEnabled={false}
            columnWrapperStyle={styles.quickLinksRow}
          />
        </View>

        {/* Announcements Section */}
        <View style={styles.announcementsSection}>
          <ThemedText style={[styles.sectionTitle, { color: textPrimaryColor }]}>
            Announcements
          </ThemedText>
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            renderItem={renderAnnouncement}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </View>

        {/* Bottom Padding */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
  },
  notificationBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  propertyCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
  },
  propertyImagePlaceholder: {
    width: 120,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  propertyLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  propertyCity: {
    fontSize: 14,
    fontWeight: '400',
  },
  rentStatusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  rentStatusHeader: {
    marginBottom: 12,
  },
  rentStatusLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  rentStatusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentAmount: {
    fontSize: 14,
    fontWeight: '400',
  },
  payButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  maintenanceButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  maintenanceButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maintenanceButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickLinksRow: {
    gap: 12,
    marginBottom: 24,
  },
  quickLinkCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
  quickLinkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  announcementsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  announcementCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    elevation: 3,
  },
  announcementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  announcementDescription: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 4,
    lineHeight: 16,
  },
  announcementDate: {
    fontSize: 10,
    fontWeight: '400',
  },
});
