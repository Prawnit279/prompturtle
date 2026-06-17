/**
 * Unit tests for SSRF URL safety — private-range detection and the
 * https + public-resolution assertion (DNS mocked).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dns/promises', () => ({
  lookup: vi.fn(),
}));

import { lookup } from 'dns/promises';
import { assertPublicWebhookUrl, isPrivateAddress, UnsafeWebhookUrlError } from '../url-safety.js';

const mockLookup = lookup as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isPrivateAddress', () => {
  it('flags private / loopback / link-local / reserved IPv4', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  it('flags loopback / link-local / unique-local IPv6 (and mapped IPv4)', () => {
    for (const ip of ['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('allows public IPv6', () => {
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false);
  });

  it('treats unparseable input as unsafe', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true);
  });
});

describe('assertPublicWebhookUrl', () => {
  it('rejects non-https urls', async () => {
    await expect(assertPublicWebhookUrl('http://example.com/hook')).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('rejects an invalid url', async () => {
    await expect(assertPublicWebhookUrl('not a url')).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it('rejects when the hostname resolves to a private address', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(assertPublicWebhookUrl('https://internal.evil.test/hook')).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it('rejects if ANY resolved address is private', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    await expect(assertPublicWebhookUrl('https://rebind.evil.test/hook')).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it('rejects when the hostname does not resolve', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicWebhookUrl('https://nope.invalid/hook')).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it('resolves for an https url that maps only to public addresses', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(assertPublicWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
  });
});
