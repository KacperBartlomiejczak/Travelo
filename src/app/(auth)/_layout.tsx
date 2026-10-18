import { Stack } from 'expo-router';

// What a signed-out user can reach (auth-onboarding steps 5-7): the welcome screen, then the e-mail screen (the code screen
// joins it in step 7). The welcome screen is declared first so it is the one a signed-out user lands on; without it the
// first screen would be "email", the first by name.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email" />
    </Stack>
  );
}
