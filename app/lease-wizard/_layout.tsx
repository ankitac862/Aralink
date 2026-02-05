import { Stack } from 'expo-router';

export default function LeaseWizardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="step1" />
      <Stack.Screen name="step2" />
      <Stack.Screen name="step3" />
      <Stack.Screen name="step4" />
      <Stack.Screen name="step5" />
      <Stack.Screen name="step6a" />
      <Stack.Screen name="step6b" />
      <Stack.Screen name="step6" />
    </Stack>
  );
}
