import { createClient } from '@supabase/supabase-js';

import { installWebCrypto } from '@/data/web-crypto';

// jest-expo's native mock of expo-crypto returns undefined; delegate to Node's crypto, which is what the native module computes.
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto') as typeof import('crypto');
  return {
    CryptoDigestAlgorithm: { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512', MD5: 'MD5' },
    getRandomValues: jest.fn(<T extends Uint8Array | Uint32Array>(array: T) => {
      nodeCrypto.randomFillSync(array);
      return array;
    }),
    digest: jest.fn(async (algorithm: string, data: ArrayBufferView) => {
      const hash = nodeCrypto.createHash(algorithm.replace('-', '').toLowerCase()).update(data as Uint8Array).digest();
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const expoCrypto = require('expo-crypto') as { digest: jest.Mock; getRandomValues: jest.Mock };

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString('hex');
const bytes = (text: string) => new TextEncoder().encode(text);

describe('installWebCrypto', () => {
  beforeEach(() => {
    expoCrypto.digest.mockClear();
    expoCrypto.getRandomValues.mockClear();
  });

  it('on an empty target creates crypto with getRandomValues from expo-crypto', () => {
    const target: Parameters<typeof installWebCrypto>[0] = {};
    installWebCrypto(target);

    const filled = target.crypto!.getRandomValues!(new Uint32Array(8));

    expect(expoCrypto.getRandomValues).toHaveBeenCalledWith(filled);
    expect(filled.some((value) => value !== 0)).toBe(true);
  });

  it('on an empty target adds subtle.digest, SHA-256 of "abc" is the known vector', async () => {
    const target: Parameters<typeof installWebCrypto>[0] = {};
    installWebCrypto(target);

    const hash = await target.crypto!.subtle!.digest('SHA-256', bytes('abc'));

    expect(hex(hash)).toBe(ABC_SHA256);
    expect(expoCrypto.digest).toHaveBeenCalledWith('SHA-256', expect.anything());
  });

  it('accepts the algorithm as { name } too, as WebCrypto does', async () => {
    const target: Parameters<typeof installWebCrypto>[0] = {};
    installWebCrypto(target);

    const hash = await target.crypto!.subtle!.digest({ name: 'SHA-256' }, bytes('abc'));

    expect(hex(hash)).toBe(ABC_SHA256);
  });

  it('rejects an algorithm it does not provide instead of guessing', async () => {
    const target: Parameters<typeof installWebCrypto>[0] = {};
    installWebCrypto(target);

    await expect(target.crypto!.subtle!.digest('SHA-1', bytes('abc'))).rejects.toThrow('SHA-1');
    await expect(target.crypto!.subtle!.digest({ name: 'MD5' }, bytes('abc'))).rejects.toThrow('MD5');
    expect(expoCrypto.digest).not.toHaveBeenCalled();
  });

  it('does not replace an existing crypto.subtle or getRandomValues', () => {
    const subtle = { digest: jest.fn() };
    const getRandomValues = jest.fn();
    const target = { crypto: { subtle, getRandomValues } };

    installWebCrypto(target);

    expect(target.crypto.subtle).toBe(subtle);
    expect(target.crypto.getRandomValues).toBe(getRandomValues);
  });

  it('keeps its own getRandomValues when crypto has no subtle, and adds subtle', async () => {
    const getRandomValues = jest.fn();
    const target: Parameters<typeof installWebCrypto>[0] = { crypto: { getRandomValues } };

    installWebCrypto(target);

    expect(target.crypto!.getRandomValues).toBe(getRandomValues);
    expect(hex(await target.crypto!.subtle!.digest('SHA-256', bytes('abc')))).toBe(ABC_SHA256);
  });
});

// Library check: the real auth-js, on a global that has no WebCrypto (as Hermes), must now send S256.
describe('installWebCrypto with the real @supabase/auth-js (PKCE)', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  beforeEach(() => {
    expoCrypto.digest.mockClear();
    expoCrypto.getRandomValues.mockClear();
    // Hermes: no global crypto at all.
    Reflect.deleteProperty(globalThis, 'crypto');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'crypto');
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    jest.restoreAllMocks();
  });

  function pkceClient() {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    };
    const fetchStub = jest.fn(async () => new Response('{}'));
    const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
      auth: { flowType: 'pkce', storage, storageKey: 'test-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchStub as unknown as typeof fetch },
    });
    return { client, store };
  }

  async function authorizeUrl(client: ReturnType<typeof pkceClient>['client']) {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'travelo://auth/callback', skipBrowserRedirect: true },
    });
    expect(error).toBeNull();
    return new URL(data.url!);
  }

  it('without the polyfill the library falls back to plain (the bug this fixes)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client } = pkceClient();

    const url = await authorizeUrl(client);

    expect(url.searchParams.get('code_challenge_method')).toBe('plain');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WebCrypto API is not supported'));
  });

  it('with the polyfill the authorize URL carries code_challenge_method=s256 and base64url(SHA-256(stored verifier))', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    installWebCrypto();
    const { client, store } = pkceClient();

    const url = await authorizeUrl(client);

    expect(url.searchParams.get('code_challenge_method')).toBe('s256');
    const verifier = JSON.parse(store.get('test-auth-code-verifier')!) as string;
    const expected = Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', bytes(verifier))).toString('base64url');
    expect(url.searchParams.get('code_challenge')).toBe(expected);
    expect(url.searchParams.get('code_challenge')).not.toBe(verifier);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('WebCrypto'));
  });

  it('draws the verifier from expo-crypto getRandomValues, not Math.random', async () => {
    const random = jest.spyOn(Math, 'random');
    installWebCrypto();
    const { client } = pkceClient();

    await authorizeUrl(client);

    expect(expoCrypto.getRandomValues).toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });
});
