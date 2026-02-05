/**
 * Location Service for Google Maps Places Autocomplete and Geolocation
 * 
 * This service provides:
 * - Google Places Autocomplete for address suggestions
 * - Reverse geocoding for "Use my location" feature
 * - Structured address parsing
 * 
 * API Key Setup:
 * - Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file
 * - For Android: Key is read from environment variables
 * - For iOS: Key is read from environment variables
 * 
 * DO NOT commit API keys to version control.
 */

 import * as Location from 'expo-location';

// Read API key from environment variables
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ Google Maps API key not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file');
}

// Structured address fields
export interface StructuredAddress {
  unit?: string;
  streetNumber: string;
  streetName: string;
  city: string;
  province: string; // state/province
  postalCode: string;
  country: string;
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
}

// Place prediction from Google Places API
export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

// Error types for handling
export type LocationErrorType = 
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'NO_RESULTS'
  | 'API_KEY_MISSING'
  | 'UNKNOWN_ERROR';

export interface LocationError {
  type: LocationErrorType;
  message: string;
}

// Default empty address
export const EMPTY_ADDRESS: StructuredAddress = {
  streetNumber: '',
  streetName: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
  formattedAddress: '',
};

/**
 * Fetch address predictions from Google Places API
 */
export async function getAddressPredictions(
  input: string,
  sessionToken?: string
): Promise<{ predictions: PlacePrediction[]; error?: LocationError }> {
  if (!GOOGLE_MAPS_API_KEY) {
    return {
      predictions: [],
      error: {
        type: 'API_KEY_MISSING',
        message: 'Google Maps API key is not configured',
      },
    };
  }

  if (!input || input.length < 3) {
    return { predictions: [] };
  }

  try {
    const params = new URLSearchParams({
      input,
      key: GOOGLE_MAPS_API_KEY,
      types: 'address',
    // components: 'country:us|country:ca', // Restrict to US and Canada
    });

    if (sessionToken) {
      params.append('sessiontoken', sessionToken);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return { predictions: [] };
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.status, data.error_message);
      return {
        predictions: [],
        error: {
          type: 'NETWORK_ERROR',
          message: data.error_message || 'Failed to fetch address suggestions',
        },
      };
    }

    const predictions: PlacePrediction[] = data.predictions.map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));

    return { predictions };
  } catch (error) {
    console.error('Error fetching address predictions:', error);
    return {
      predictions: [],
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to fetch address suggestions. Please check your internet connection.',
      },
    };
  }
}

/**
 * Get detailed address from Place ID
 */
export async function getPlaceDetails(
  placeId: string
): Promise<{ address: StructuredAddress | null; error?: LocationError }> {
  if (!GOOGLE_MAPS_API_KEY) {
    return {
      address: null,
      error: {
        type: 'API_KEY_MISSING',
        message: 'Google Maps API key is not configured',
      },
    };
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_API_KEY,
      fields: 'address_components,formatted_address,geometry',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Place details API error:', data.status, data.error_message);
      return {
        address: null,
        error: {
          type: 'NO_RESULTS',
          message: 'Could not find address details',
        },
      };
    }

    return { address: parseAddressComponents(data.result) };
  } catch (error) {
    console.error('Error fetching place details:', error);
    return {
      address: null,
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to fetch address details. Please check your internet connection.',
      },
    };
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ address: StructuredAddress | null; error?: LocationError }> {
  if (!GOOGLE_MAPS_API_KEY) {
    return {
      address: null,
      error: {
        type: 'API_KEY_MISSING',
        message: 'Google Maps API key is not configured',
      },
    };
  }

  try {
    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: GOOGLE_MAPS_API_KEY,
      result_type: 'street_address',
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      return {
        address: null,
        error: {
          type: 'NO_RESULTS',
          message: 'No address found for this location',
        },
      };
    }

    if (data.status !== 'OK') {
      console.error('Geocode API error:', data.status, data.error_message);
      return {
        address: null,
        error: {
          type: 'NETWORK_ERROR',
          message: 'Failed to get address from location',
        },
      };
    }

    const address = parseAddressComponents(data.results[0]);
    address.latitude = latitude;
    address.longitude = longitude;

    return { address };
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return {
      address: null,
      error: {
        type: 'NETWORK_ERROR',
        message: 'Failed to get address from location. Please check your internet connection.',
      },
    };
  }
}

/**
 * Request location permissions and get current location
 */
export async function getCurrentLocation(): Promise<{
  location: { latitude: number; longitude: number } | null;
  error?: LocationError;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return {
        location: null,
        error: {
          type: 'PERMISSION_DENIED',
          message: 'Location permission was denied. Please enable location access in your device settings.',
        },
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return {
      location: null,
      error: {
        type: 'LOCATION_UNAVAILABLE',
        message: 'Could not get your current location. Please try again.',
      },
    };
  }
}

/**
 * Get address from current location (combines getCurrentLocation + reverseGeocode)
 */
export async function getAddressFromCurrentLocation(): Promise<{
  address: StructuredAddress | null;
  error?: LocationError;
}> {
  const locationResult = await getCurrentLocation();

  if (locationResult.error || !locationResult.location) {
    return { address: null, error: locationResult.error };
  }

  const geocodeResult = await reverseGeocode(
    locationResult.location.latitude,
    locationResult.location.longitude
  );

  return geocodeResult;
}

/**
 * Parse Google address components into structured address
 */
function parseAddressComponents(place: any): StructuredAddress {
  const components = place.address_components || [];
  const geometry = place.geometry;

  const getComponent = (types: string[]): string => {
    const component = components.find((c: any) =>
      types.some((type) => c.types.includes(type))
    );
    return component?.long_name || '';
  };

  const getShortComponent = (types: string[]): string => {
    const component = components.find((c: any) =>
      types.some((type) => c.types.includes(type))
    );
    return component?.short_name || '';
  };

  return {
    unit: getComponent(['subpremise']),
    streetNumber: getComponent(['street_number']),
    streetName: getComponent(['route']),
    city: getComponent(['locality', 'sublocality', 'sublocality_level_1', 'administrative_area_level_3']),
    province: getShortComponent(['administrative_area_level_1']),
    postalCode: getComponent(['postal_code']),
    country: getComponent(['country']),
    formattedAddress: place.formatted_address || '',
    latitude: geometry?.location?.lat,
    longitude: geometry?.location?.lng,
  };
}

/**
 * Generate a session token for Places API (for billing optimization)
 */
export function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Format address for display
 */
export function formatAddressForDisplay(address: StructuredAddress): string {
  const parts = [];
  
  if (address.unit) {
    parts.push(`Unit ${address.unit}`);
  }
  
  if (address.streetNumber && address.streetName) {
    parts.push(`${address.streetNumber} ${address.streetName}`);
  } else if (address.streetName) {
    parts.push(address.streetName);
  }

  if (address.city) {
    parts.push(address.city);
  }

  if (address.province) {
    parts.push(address.province);
  }

  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.join(', ');
}
