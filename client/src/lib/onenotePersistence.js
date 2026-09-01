export const LEGACY_RICH_TEXT_PREFIX = 'lm_editor_rich';
export const PENDING_RICH_TEXT_PREFIX = 'lm_editor_rich_pending';

export function isPersistedPageId(pageId) {
  return Number.isSafeInteger(Number(pageId)) && Number(pageId) > 0;
}

export function readRichText(blocks) {
  return readRichTextState(blocks).html;
}

export function readRichTextState(blocks) {
  const block = blocks.find((item) => item.type === 'rich_text');
  if (!block?.content) return { html: '', updatedAt: null };
  try {
    const content = JSON.parse(block.content);
    return {
      html: typeof content.html === 'string' ? content.html : '',
      updatedAt: typeof block.updatedAt === 'string' ? block.updatedAt : null,
    };
  } catch {
    return { html: '', updatedAt: null };
  }
}

export function createRichTextPending(html, now = new Date()) {
  return { value: html, updatedAt: now.toISOString() };
}

export function isNewerRichTextPending(pending, persisted) {
  const localTime = Date.parse(pending?.updatedAt || '');
  const backendTime = Date.parse(persisted?.updatedAt || '');
  return Number.isFinite(localTime) && (!Number.isFinite(backendTime) || localTime > backendTime);
}
