# API Keys Configuration Guide

This document describes how to set up API keys for the Aaralink application. **NEVER commit API keys to version control.**

## Required API Keys

### 1. Google Maps API Key

Used for:
- Address autocomplete (Google Places API)
- Geocoding and reverse geocoding
- "Use my location" feature

#### Obtaining the Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Places API** (for address autocomplete)
   - **Geocoding API** (for reverse geocoding)
4. Create credentials → API Key
5. Optionally restrict the key:
   - For Android: Add package name restrictions
   - For iOS: Add bundle identifier restrictions
   - For Web: Add HTTP referrer restrictions

#### Local Development Setup

Create a `.env.local` file in the `Aralink` directory (this file is gitignored):

```env
# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Supabase (if not already set)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Android Configuration

For Android, the API key is read from environment variables at build time. 

If you need to configure it in `AndroidManifest.xml` for native modules:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application>
    <meta-data
        android:name="com.google.android.geo.API_KEY"
        android:value="${GOOGLE_MAPS_API_KEY}" />
</application>
```

And in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        manifestPlaceholders = [
            GOOGLE_MAPS_API_KEY: System.getenv("GOOGLE_MAPS_API_KEY") ?: ""
        ]
    }
}
```

#### iOS Configuration

For iOS, add to `ios/Aaralink/Info.plist`:

```xml
<key>GMSApiKey</key>
<string>$(GOOGLE_MAPS_API_KEY)</string>
```

Or use `expo-constants` to read from app.json extra config.

### 2. Supabase Keys

Already configured in the project. See `.env.local.example` for reference.

## CI/CD Configuration

### GitHub Actions

Add secrets in your GitHub repository settings:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `GOOGLE_MAPS_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

Example workflow usage:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create .env.local
        run: |
          echo "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=${{ secrets.GOOGLE_MAPS_API_KEY }}" >> .env.local
          echo "EXPO_PUBLIC_SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env.local
          echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> .env.local
```

### EAS Build

For Expo EAS builds, add secrets via the Expo dashboard or CLI:

```bash
# Using EAS CLI
eas secret:create --name GOOGLE_MAPS_API_KEY --value "your_key_here"
eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "your_key_here"
```

Or in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY": "@GOOGLE_MAPS_API_KEY"
      }
    }
  }
}
```

## Security Best Practices

1. **Never commit keys to Git** - Always use environment variables
2. **Restrict API keys** - Use platform-specific restrictions in Google Cloud Console
3. **Use different keys for environments** - Separate keys for dev/staging/production
4. **Monitor usage** - Set up billing alerts and usage quotas
5. **Rotate keys periodically** - Especially if there's any suspicion of compromise

## Troubleshooting

### "API key not configured" warning

If you see this warning in the console:
```
⚠️ Google Maps API key not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file
```

1. Ensure `.env.local` exists in the `Aralink` directory
2. Verify the key name is exactly `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Restart the development server after adding the key

### Address autocomplete not working

1. Verify the Places API is enabled in Google Cloud Console
2. Check that the API key has no restrictions blocking your usage
3. Verify network connectivity

### Geocoding fails

1. Ensure the Geocoding API is enabled
2. Check the API key quota/limits in Google Cloud Console
