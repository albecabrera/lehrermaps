export function normalizeShortLinkUrl(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || /\s/.test(input) || input.startsWith('//')) return null;

  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}
