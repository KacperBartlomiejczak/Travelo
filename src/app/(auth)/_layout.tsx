import { Stack } from 'expo-router';

// What a signed-out user can reach (auth-onboarding step 5): the welcome screen now; the e-mail and code screens in step 7.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
