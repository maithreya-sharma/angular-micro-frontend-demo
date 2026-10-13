import { FormSchema } from '../schema/form-schema';

/**
 * Encode a schema into a compact, URL-safe string so a whole form fits in a
 * share link with no backend. Uses the browser's native CompressionStream
 * (deflate-raw) and falls back to plain base64 where it's missing.
 *
 *   "z." + base64url(deflate(json))   compressed
 *   "j." + base64url(json)            fallback
 */
const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

export async function encodeSchema(schema: FormSchema): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(schema));
  if (!canCompress()) return `j.${toBase64Url(bytes)}`;
  const compressed = await pipe(bytes, new CompressionStream('deflate-raw'));
  return `z.${toBase64Url(compressed)}`;
}

/** Decode a share string back to untrusted JSON. Run it through parseSchema() before use. */
export async function decodeSchema(encoded: string): Promise<unknown> {
  const [prefix, payload] = [encoded.slice(0, 2), encoded.slice(2)];
  let bytes = fromBase64Url(payload);
  if (prefix === 'z.') {
    if (!canCompress()) throw new Error('This browser cannot open compressed share links.');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (prefix !== 'j.') {
    throw new Error('This share link is not a Formloom link.');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
