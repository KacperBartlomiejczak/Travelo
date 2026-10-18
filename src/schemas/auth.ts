import { z } from 'zod';

// Sign-in by e-mail code. Error messages are i18n keys, translated by the screens.

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: 'validation.emailFormat' }));

export const OTP_CODE_LENGTH = 6;
export const OtpCodeSchema = z.string().regex(new RegExp(`^[0-9]{${OTP_CODE_LENGTH}}$`), { error: 'validation.otpFormat' });

export const EmailSignInInputSchema = z.object({ email: EmailSchema });
export type EmailSignInInput = z.infer<typeof EmailSignInInputSchema>;

export const EmailCodeInputSchema = z.object({ email: EmailSchema, code: OtpCodeSchema });
export type EmailCodeInput = z.infer<typeof EmailCodeInputSchema>;
