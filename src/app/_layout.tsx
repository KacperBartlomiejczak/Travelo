import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from "@expo-google-fonts/fraunces";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import "@/i18n";
import { FullScreenError } from "@/features/auth/FullScreenError";
import { useGateView } from "@/features/auth/useGateView";
import { AppProviders } from "@/providers/AppProviders";
import { useTheme } from "@/theme/useTheme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  // On a font error the app still renders, with system fonts.
  const ready = fontsLoaded || fontError !== null;

  if (!ready) {
    return null;
  }

  return (
    <AppProviders>
      <Gate />
    </AppProviders>
  );
}

// What the app shows for who is using it (auth-onboarding step 5). Each group of screens is protected by a guard
// (expo-router `Stack.Protected`): a screen whose guard is false is removed from the navigator, a link or the OAuth
// redirect to it lands on the first screen that is allowed, and when a guard flips the user is moved there too.
// - signed out: the (auth) group only;
// - signed in without a profile: profile setup only;
// - signed in with a profile: the app.
// While the session or the profile is still being read the splash screen stays (afterwards, a blank screen in the theme's
// background); a failure to read either is a full-screen error with a retry, never the welcome screen or the setup form.
function Gate() {
  const { t } = useTranslation();
  const { view, retry } = useGateView();
  const { colors } = useTheme();

  useEffect(() => {
    if (view !== "loading") SplashScreen.hideAsync();
  }, [view]);

  if (view === "loading") {
    return <View testID="app-loading" accessible accessibilityState={{ busy: true }} style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (view === "startError") {
    return <FullScreenError testID="start-error" message={t("auth.startError")} retryLabel={t("auth.retry")} onRetry={retry} />;
  }
  if (view === "profileError") {
    return <FullScreenError testID="profile-error" message={t("auth.profileLoadError")} retryLabel={t("auth.retry")} onRetry={retry} />;
  }

  return (
    <Stack>
      <Stack.Protected guard={view === "signedOut"}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={view === "onboarding"}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={view === "app"}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="trips/new" options={{ headerShown: false }} />
        {/* The trip's photos full screen over the home screen (trip-photos D6, P4). */}
        <Stack.Screen name="trips/[tripId]/photos" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      {/* The OAuth redirect can open the app here in any state; the screen only redirects to /. */}
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
