import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

import { COUNTRY_CODES, Country, DEFAULT_COUNTRY } from '@/constants/countryCodes';
import { detectIdentifierMode } from '@/utils/identifierInput';

interface IdentifierInputProps
  extends Pick<TextInputProps, 'placeholder' | 'autoCapitalize' | 'returnKeyType' | 'onSubmitEditing'> {
  value: string;
  onChangeText: (value: string) => void;
  isDark: boolean;
  borderColor: string;
  textColor: string;
  placeholderColor: string;
  inputBgColor: string;
}

// "Email or Phone Number" input. Once the user starts typing digits, the
// numeric keyboard opens and a country-code picker (flag + dial code)
// appears so the dial code doesn't need to be typed manually.
export function IdentifierInput({
  value,
  onChangeText,
  isDark,
  borderColor,
  textColor,
  placeholderColor,
  inputBgColor,
  ...textInputProps
}: IdentifierInputProps) {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');

  const mode = detectIdentifierMode(value);
  const isPhone = mode === 'phone';

  const displayValue = isPhone && value.startsWith(country.dialCode)
    ? value.slice(country.dialCode.length)
    : value;

  const handleChangeText = (next: string) => {
    const nextMode = detectIdentifierMode(next) || mode;
    if (nextMode === 'phone') {
      const digits = next.replace(/\D/g, '');
      onChangeText(`${country.dialCode}${digits}`);
    } else {
      onChangeText(next);
    }
  };

  const handleSelectCountry = (next: Country) => {
    const digits = displayValue.replace(/\D/g, '');
    setCountry(next);
    setPickerVisible(false);
    setSearch('');
    onChangeText(`${next.dialCode}${digits}`);
  };

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search)
  );

  return (
    <View style={styles.row}>
      {isPhone && (
        <TouchableOpacity
          style={[styles.countryButton, { borderColor, backgroundColor: inputBgColor }]}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={[styles.dialCode, { color: textColor }]}>{country.dialCode}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={placeholderColor} />
        </TouchableOpacity>
      )}

      <TextInput
        style={[
          styles.input,
          { borderColor, backgroundColor: inputBgColor, color: textColor },
        ]}
        placeholderTextColor={placeholderColor}
        keyboardType={isPhone ? 'phone-pad' : 'email-address'}
        value={displayValue}
        onChangeText={handleChangeText}
        {...textInputProps}
      />

      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#1A1B1E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>Select country code</Text>
            <TextInput
              style={[
                styles.searchInput,
                { borderColor, backgroundColor: inputBgColor, color: textColor },
              ]}
              placeholder="Search country or code"
              placeholderTextColor={placeholderColor}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item, index) => `${item.iso2}-${index}`}
              style={styles.countryList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.countryName, { color: textColor }]}>{item.name}</Text>
                  <Text style={[styles.dialCode, { color: placeholderColor }]}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  flag: {
    fontSize: 18,
  },
  dialCode: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  countryList: {
    maxHeight: 320,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.3)',
  },
  countryName: {
    flex: 1,
    fontSize: 14,
  },
});
