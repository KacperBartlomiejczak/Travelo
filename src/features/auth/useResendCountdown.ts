import { useEffect, useState } from 'react';

/** Supabase allows one code per address every 60 s (auth-onboarding P3). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Whole seconds left until a new code may be requested, counting from `sentAt` (epoch ms); 0 once it may. Ticks every second. */
export function useResendCountdown(sentAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  // A restart sets a newer `sentAt` than the last tick, so the value is capped until the next tick.
  const remaining = Math.min(RESEND_COOLDOWN_SECONDS, Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000)));
  const running = remaining > 0;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, sentAt]);

  return remaining;
}

/** 42 -> "0:42", 60 -> "1:00". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** For screen readers: the seconds rounded up to the next 10, so the spoken value changes at most every 10 s. */
export function spokenSeconds(seconds: number): number {
  return Math.ceil(seconds / 10) * 10;
}
