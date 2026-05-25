import { Stack } from 'expo-router';

export default function AraPartnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="submit-referral" options={{ presentation: 'modal' }} />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="payouts" />
    </Stack>
  );
}
