export function normalizeShortLinkUrl(value) {
  const input = String(value ?? '').trim();
  if (!input || /\s/.test(input)) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return null;
  if (input.startsWith('//')) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}
