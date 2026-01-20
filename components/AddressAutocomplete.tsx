/**
 * AddressAutocomplete Component
 * 
 * A reusable address input component with:
 * - Google Places Autocomplete
 * - "Use my location" button for geolocation
 * - Structured address output
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  StructuredAddress,
  PlacePrediction,
  EMPTY_ADDRESS,
  getAddressPredictions,
  getPlaceDetails,
  getAddressFromCurrentLocation,
  generateSessionToken,
  formatAddressForDisplay,
} from '@/services/location-service';

interface AddressAutocompleteProps {
  onAddressSelect: (address: StructuredAddress) => void;
  initialAddress?: StructuredAddress;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showUseMyLocation?: boolean;
}

export default function AddressAutocomplete({
  onAddressSelect,
  initialAddress,
  placeholder = 'Start typing address...',
  label = 'Address',
  required = false,
  showUseMyLocation = true,
}: AddressAutocompleteProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Theme colors
  const bgColor = isDark ? '#101922' : '#f6f7f8';
  const inputBgColor = isDark ? '#1f2937' : '#ffffff';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#f3f4f6' : '#1f2937';
  const secondaryTextColor = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#137fec';

  const [inputValue, setInputValue] = useState(
    initialAddress?.formattedAddress || ''
  );
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [sessionToken] = useState(generateSessionToken());

  // Debounce timer ref
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Update input value when initialAddress changes
  useEffect(() => {
    if (initialAddress?.formattedAddress) {
      setInputValue(initialAddress.formattedAddress);
    }
  }, [initialAddress]);

  // Fetch predictions with debounce
  const fetchPredictions = useCallback(
    async (text: string) => {
      if (text.length < 3) {
        setPredictions([]);
        setShowPredictions(false);
        return;
      }

      setIsLoading(true);
      const result = await getAddressPredictions(text, sessionToken);
      
      if (result.error) {
        console.warn('Address prediction error:', result.error.message);
      }

      setPredictions(result.predictions);
      setShowPredictions(result.predictions.length > 0);
      setIsLoading(false);
    },
    [sessionToken]
  );

  // Handle text input change
  const handleInputChange = (text: string) => {
    setInputValue(text);

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      fetchPredictions(text);
    }, 300);

    setDebounceTimer(timer);
  };

  // Handle prediction selection
  const handlePredictionSelect = async (prediction: PlacePrediction) => {
    setInputValue(prediction.description);
    setShowPredictions(false);
    setPredictions([]);
    setIsLoading(true);

    const result = await getPlaceDetails(prediction.placeId);

    if (result.error) {
      Alert.alert('Error', result.error.message);
      setIsLoading(false);
      return;
    }

    if (result.address) {
      onAddressSelect(result.address);
    }

    setIsLoading(false);
  };

  // Handle "Use my location" button
  const handleUseMyLocation = async () => {
    setIsGettingLocation(true);
    setShowPredictions(false);

    const result = await getAddressFromCurrentLocation();

    if (result.error) {
      Alert.alert(
        'Location Error',
        result.error.message,
        [{ text: 'OK' }]
      );
      setIsGettingLocation(false);
      return;
    }

    if (result.address) {
      setInputValue(result.address.formattedAddress);
      onAddressSelect(result.address);
    }

    setIsGettingLocation(false);
  };

  // Clear input
  const handleClear = () => {
    setInputValue('');
    setPredictions([]);
    setShowPredictions(false);
    onAddressSelect(EMPTY_ADDRESS);
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <ThemedText style={[styles.label, { color: textColor }]}>
            {label}
            {required && (
              <ThemedText style={{ color: '#ef4444' }}> *</ThemedText>
            )}
          </ThemedText>
        </View>
      )}

      {/* Input Field */}
      <View style={styles.inputContainer}>
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: inputBgColor, borderColor },
          ]}
        >
          <MaterialCommunityIcons
            name="map-marker"
            size={20}
            color={secondaryTextColor}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, { color: textColor }]}
            placeholder={placeholder}
            placeholderTextColor={secondaryTextColor}
            value={inputValue}
            onChangeText={handleInputChange}
            onFocus={() => {
              if (predictions.length > 0) {
                setShowPredictions(true);
              }
            }}
          />
          {isLoading && (
            <ActivityIndicator
              size="small"
              color={primaryColor}
              style={styles.loadingIndicator}
            />
          )}
          {inputValue.length > 0 && !isLoading && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={secondaryTextColor}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Use My Location Button */}
        {showUseMyLocation && (
          <TouchableOpacity
            style={[
              styles.locationButton,
              { backgroundColor: primaryColor, opacity: isGettingLocation ? 0.7 : 1 },
            ]}
            onPress={handleUseMyLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Predictions Dropdown */}
      {showPredictions && predictions.length > 0 && (
        <View
          style={[
            styles.predictionsContainer,
            { backgroundColor: inputBgColor, borderColor },
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.predictionsScroll}
          >
            {predictions.map((prediction, index) => (
              <TouchableOpacity
                key={prediction.placeId}
                style={[
                  styles.predictionItem,
                  {
                    borderBottomColor: borderColor,
                    borderBottomWidth: index < predictions.length - 1 ? 1 : 0,
                  },
                ]}
                onPress={() => handlePredictionSelect(prediction)}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={18}
                  color={secondaryTextColor}
                  style={styles.predictionIcon}
                />
                <View style={styles.predictionTextContainer}>
                  <ThemedText
                    style={[styles.predictionMainText, { color: textColor }]}
                    numberOfLines={1}
                  >
                    {prediction.mainText}
                  </ThemedText>
                  {prediction.secondaryText && (
                    <ThemedText
                      style={[
                        styles.predictionSecondaryText,
                        { color: secondaryTextColor },
                      ]}
                      numberOfLines={1}
                    >
                      {prediction.secondaryText}
                    </ThemedText>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionsContainer: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 200,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  predictionsScroll: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  predictionIcon: {
    marginRight: 12,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 14,
    fontWeight: '500',
  },
  predictionSecondaryText: {
    fontSize: 12,
    marginTop: 2,
  },
});
