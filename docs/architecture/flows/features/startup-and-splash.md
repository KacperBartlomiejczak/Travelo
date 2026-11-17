# Startup, splash and loading screen

- Native splash: configured in `app.json` (`expo-splash-screen`, paper `#F8F4EC` / dark `#171716` with the logo symbol). The root layout calls `SplashScreen.preventAutoHideAsync()` and hides it as the gate mounts.
- Root layout (`src/app/_layout.tsx`): applies the saved theme (`applyThemePreference(readThemePreference())`) before the first render, and renders nothing until the fonts have loaded or failed.
- Animated splash: the Lottie logo animation `assets/animations/splash.json`, shown by `AnimatedSplash` (`src/components/`). It covers the gate, plays once and is hidden for good afterwards (`splashDone`). Reduced motion skips the play and uses a shorter fade. The `splash-spinner` shows only after the animation has ended while the app is not ready yet, labelled "Loading app".
- Gate loading view: `AppLoading` (`src/features/auth/`, label "Loading") shows `HomeSkeleton` (`src/features/home/`) with placeholders for the menu button (`app-loading-menu`) and the pill (`app-loading-pill`) while the session and profile load; see [auth-and-gate.md](auth-and-gate.md) for the gate states.

Plans and decisions: `prompts/splash-animation/plan.md`, `prompts/app-loading-skeleton/plan.md`.
