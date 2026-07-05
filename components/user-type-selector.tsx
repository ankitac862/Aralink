import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';

type UserType = 'landlord' | 'tenant' | 'manager';

interface UserTypeSelectorProps {
  selectedType: UserType | null;
  onTypeSelect: (type: UserType) => void;
}

export function UserTypeSelector({ selectedType, onTypeSelect }: UserTypeSelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const border = isDark ? '#26282C' : '#E5E5E7';
  const cardBg = isDark ? '#141517' : '#F7F7F8';
  const chipBg = isDark ? '#26282C' : '#E8E8EA';
  const accent = isDark ? '#FFFFFF' : '#111315';
  const onAccent = isDark ? '#0B0B0C' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111315';

  const userTypes: { type: UserType; label: string; description: string; icon: string }[] = [
    {
      type: 'landlord',
      label: 'Landlord',
      description: 'Manage properties and collect rent',
      icon: 'home-city',
    },
    {
      type: 'tenant',
      label: 'Tenant',
      description: 'Pay rent and manage requests',
      icon: 'account-home',
    },
    {
      type: 'manager',
      label: 'Manager',
      description: 'Oversee multiple properties',
      icon: 'briefcase',
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        I am a...
      </ThemedText>
      <View style={styles.selectorContainer}>
        {userTypes.map((item) => {
          const selected = selectedType === item.type;
          return (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.selectorCard,
                { backgroundColor: cardBg, borderColor: selected ? accent : border },
              ]}
              onPress={() => onTypeSelect(item.type)}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: selected ? accent : chipBg },
                ]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={32}
                  color={selected ? onAccent : text}
                />
              </View>
              <ThemedText style={styles.selectorLabel}>{item.label}</ThemedText>
              <ThemedText style={styles.selectorDescription}>{item.description}</ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectorContainer: {
    gap: 12,
  },
  selectorCard: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectorDescription: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
});
