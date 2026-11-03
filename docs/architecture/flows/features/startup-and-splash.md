# Startup, splash and loading screen

- Native splash: configured in `app.json` (`expo-splash-screen`, paper `#F8F4EC` / dark `#171716` with the logo symbol).
- Animated splash: the Lottie logo animation `assets/animations/splash.json`, shown by `AnimatedSplash` (`src/components/`).
- Gate loading view: `AppLoading` (`src/features/auth/`) shows `HomeSkeleton` with placeholders for the menu button and the pill while the session and profile load; see [sign-in-and-gate](auth-and-gate.md) for the gate states.

Plans and decisions: `prompts/splash-animation/plan.md`, `prompts/app-loading-skeleton/plan.md`.
