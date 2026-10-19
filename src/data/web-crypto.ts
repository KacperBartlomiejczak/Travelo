import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

/**
 * What `@supabase/auth-js` reads from the global `crypto` for PKCE: `getRandomValues` for the verifier and `subtle.digest`
 * for the S256 challenge.
 */
type WebCrypto = {
  getRandomValues?: typeof getRandomValues;
  subtle?: { digest(algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> };
};

type WebCryptoTarget = { crypto?: WebCrypto };

async function digestSha256(algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  if (name.toUpperCase() !== CryptoDigestAlgorithm.SHA256) throw new Error(`Unsupported digest algorithm: ${name}`);
  return digest(CryptoDigestAlgorithm.SHA256, data);
}

/**
 * Hermes has no WebCrypto, so `@supabase/auth-js` would send the PKCE verifier itself as the challenge (`plain`) and build
 * it from `Math.random` (decided 2026-10-19, prompts/pkce-sha256). This fills in what is missing, on top of `expo-crypto`:
 * `crypto`, `getRandomValues` and `subtle.digest` (SHA-256 only, any other algorithm is rejected). Whatever already exists
 * (web, Jest on Node) is left alone.
 *
 * Only `digest` is provided on purpose: with a `subtle` present, `getClaims` would verify the JWT locally with `importKey`
 * and `verify`, which do not exist here. The app does not use `getClaims` (it asks the server with `getUser`).
 */
export function installWebCrypto(target: WebCryptoTarget = globalThis as WebCryptoTarget): void {
  const webCrypto = (target.crypto ??= {});
  webCrypto.getRandomValues ??= getRandomValues;
  webCrypto.subtle ??= { digest: digestSha256 };
}
