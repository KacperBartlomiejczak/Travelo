import { EmailCodeInputSchema, EmailSchema, EmailSignInInputSchema, OTP_CODE_LENGTH, OtpCodeSchema } from '@/schemas';

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('Email', () => {
  it('trims and lowercases', () => {
    expect(EmailSchema.parse(' Kacper@Example.COM ')).toBe('kacper@example.com');
  });

  it.each(['kacper', '', '   ', 'kacper@', '@example.com', 'kac per@example.com'])('rejects %p with the format key', (value) => {
    const result = EmailSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(['validation.emailFormat']);
  });
});

describe('OtpCode', () => {
  it('is 6 digits long', () => {
    expect(OTP_CODE_LENGTH).toBe(6);
  });

  it.each(['123456', '000000'])('accepts %p', (value) => {
    expect(OtpCodeSchema.parse(value)).toBe(value);
  });

  it.each(['12345', '1234567', '12a456', ' 123456', '123456 ', '', '12 456', '١٢٣٤٥٦'])(
    'rejects %p with the format key',
    (value) => {
      const result = OtpCodeSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(messages(result)).toEqual(['validation.otpFormat']);
    },
  );
});

describe('EmailSignInInput', () => {
  it('normalises the address', () => {
    expect(EmailSignInInputSchema.parse({ email: ' A@B.co ' })).toEqual({ email: 'a@b.co' });
  });

  it('rejects a bad address with the path', () => {
    const result = EmailSignInInputSchema.safeParse({ email: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['email']);
    expect(messages(result)).toEqual(['validation.emailFormat']);
  });
});

describe('EmailCodeInput', () => {
  it('accepts an address and a code', () => {
    expect(EmailCodeInputSchema.parse({ email: 'A@B.co', code: '123456' })).toEqual({ email: 'a@b.co', code: '123456' });
  });

  it('reports both fields', () => {
    const result = EmailCodeInputSchema.safeParse({ email: 'nope', code: '12' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([
      ['email', 'validation.emailFormat'],
      ['code', 'validation.otpFormat'],
    ]);
  });
});
