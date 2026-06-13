/**
 * SSRF protection for outbound webhook URLs (Week 3 hardening).
 *
 * Webhook URLs are tenant-supplied and the server POSTs to them, so an attacker
 * could otherwise point one at internal infrastructure (cloud metadata, private
 * ranges, loopback). We reject any URL that is not https, or whose hostname
 * resolves to a private / loopback / link-local / reserved address.
 *
 * Checked at registration (POST/PATCH) and again at delivery time, so a hostname
 * that is repointed at an internal IP after registration is still blocked. A
 * narrow DNS-rebinding window remains between this check and fetch's own
 * resolution; pinning the connection to the validated IP would close it fully
 * but is out of scope for v1.
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeWebhookUrlError';
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||                                  // "this" network
    a === 10 ||                                 // private
    a === 127 ||                                // loopback
    (a === 169 && b === 254) ||                 // link-local (incl. 169.254.169.254 metadata)
    (a === 172 && b >= 16 && b <= 31) ||        // private
    (a === 192 && b === 168) ||                 // private
    (a === 100 && b >= 64 && b <= 127) ||       // CGNAT (RFC 6598)
    a >= 224                                     // multicast / reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;          // loopback / unspecified
  if (lower.startsWith('fe80')) return true;                  // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return false;
}

/** True if an IP literal is in a private / loopback / link-local / reserved range. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a recognizable IP → unsafe
}

/**
 * Throws UnsafeWebhookUrlError if the URL is not https or resolves to a
 * non-public address. Resolves all A/AAAA records and rejects if ANY is private.
 */
export async function assertPublicWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeWebhookUrlError('url is not a valid URL');
  }

  if (url.protocol !== 'https:') {
    throw new UnsafeWebhookUrlError('url must use https');
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new UnsafeWebhookUrlError('url hostname does not resolve');
  }

  if (addresses.length === 0) {
    throw new UnsafeWebhookUrlError('url hostname does not resolve');
  }
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnsafeWebhookUrlError('url resolves to a non-public address');
    }
  }
}
