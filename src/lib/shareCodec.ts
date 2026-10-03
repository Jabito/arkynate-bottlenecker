import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';
import { toPortable } from './portable';

type AppNode = Node<NodeData>;

/**
 * Share links carry the diagram in the URL fragment, which browsers never send to the server:
 *   /playground#d=<base64url(deflate-raw(JSON))>
 * Browsers without CompressionStream fall back to `#j=<base64url(JSON)>`.
 * Legacy links (`?diagram=<standard base64 JSON>`) still decode.
 */
const SHARE_VERSION = 1;

export interface ShareLocation {
  /** `d` compressed, `j` uncompressed fragment, `legacy` old ?diagram= query. */
  kind: 'd' | 'j' | 'legacy';
  token: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBytes(b64: string): Uint8Array {
  // Accept both alphabets; restore '+' that a query-string parser turned into a space.
  const std = b64.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const body = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

const canCompress = () => typeof CompressionStream !== 'undefined';

/** Builds the fragment (without '#') for a diagram: computed and transient fields are stripped first. */
export async function encodeShareFragment(name: string, nodes: AppNode[], edges: Edge[]): Promise<string> {
  const json = JSON.stringify({ v: SHARE_VERSION, name, ...toPortable(nodes, edges) });
  const raw = new TextEncoder().encode(json);
  if (!canCompress()) return `j=${bytesToBase64Url(raw)}`;
  const packed = await pipe(raw, new CompressionStream('deflate-raw'));
  return `d=${bytesToBase64Url(packed)}`;
}

/** Decodes a share token to the untrusted payload object. Throws on any damage. */
export async function decodeShareToken(loc: ShareLocation): Promise<unknown> {
  const bytes = base64ToBytes(loc.token);
  if (loc.kind === 'd') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open compressed share links');
    const json = new TextDecoder('utf-8', { fatal: true }).decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    return JSON.parse(json);
  }
  // 'j' and legacy links are base64 of UTF-8 JSON.
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/**
 * Finds a share payload in a location. Reads the raw query string, never URLSearchParams,
 * so a legacy token's '+' is not turned into a space.
 */
export function readShareLocation(loc: { hash: string; search: string }): ShareLocation | null {
  const hash = loc.hash.replace(/^#/, '');
  const frag = /(?:^|&)([dj])=([^&]+)/.exec(hash);
  if (frag) return { kind: frag[1] as 'd' | 'j', token: frag[2] };
  const legacy = /(?:^\?|&)diagram=([^&]+)/.exec(loc.search);
  if (legacy) {
    let token = legacy[1];
    try { token = decodeURIComponent(token); } catch { /* keep raw */ }
    return { kind: 'legacy', token };
  }
  return null;
}
