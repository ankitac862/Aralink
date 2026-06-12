// Common country dial codes used by the phone-number country picker on the
// login/register "Email or Phone Number" field.

export interface Country {
  name: string;
  dialCode: string;
  flag: string;
  iso2: string;
}

export const COUNTRY_CODES: Country[] = [
  { name: 'United States', dialCode: '+1', flag: '🇺🇸', iso2: 'US' },
  { name: 'Canada', dialCode: '+1', flag: '🇨🇦', iso2: 'CA' },
  { name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', iso2: 'GB' },
  { name: 'India', dialCode: '+91', flag: '🇮🇳', iso2: 'IN' },
  { name: 'Australia', dialCode: '+61', flag: '🇦🇺', iso2: 'AU' },
  { name: 'Germany', dialCode: '+49', flag: '🇩🇪', iso2: 'DE' },
  { name: 'France', dialCode: '+33', flag: '🇫🇷', iso2: 'FR' },
  { name: 'Spain', dialCode: '+34', flag: '🇪🇸', iso2: 'ES' },
  { name: 'Italy', dialCode: '+39', flag: '🇮🇹', iso2: 'IT' },
  { name: 'Mexico', dialCode: '+52', flag: '🇲🇽', iso2: 'MX' },
  { name: 'Brazil', dialCode: '+55', flag: '🇧🇷', iso2: 'BR' },
  { name: 'China', dialCode: '+86', flag: '🇨🇳', iso2: 'CN' },
  { name: 'Japan', dialCode: '+81', flag: '🇯🇵', iso2: 'JP' },
  { name: 'South Korea', dialCode: '+82', flag: '🇰🇷', iso2: 'KR' },
  { name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', iso2: 'AE' },
  { name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', iso2: 'SA' },
  { name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', iso2: 'PK' },
  { name: 'Bangladesh', dialCode: '+880', flag: '🇧🇩', iso2: 'BD' },
  { name: 'Philippines', dialCode: '+63', flag: '🇵🇭', iso2: 'PH' },
  { name: 'Indonesia', dialCode: '+62', flag: '🇮🇩', iso2: 'ID' },
  { name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', iso2: 'NG' },
  { name: 'South Africa', dialCode: '+27', flag: '🇿🇦', iso2: 'ZA' },
  { name: 'Singapore', dialCode: '+65', flag: '🇸🇬', iso2: 'SG' },
  { name: 'Netherlands', dialCode: '+31', flag: '🇳🇱', iso2: 'NL' },
  { name: 'Switzerland', dialCode: '+41', flag: '🇨🇭', iso2: 'CH' },
  { name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', iso2: 'NZ' },
];

export const DEFAULT_COUNTRY: Country = COUNTRY_CODES[0];
