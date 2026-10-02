import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createShortLink } from '../lib/api';
import { normalizeShortLinkUrl } from '../lib/shortLinkUrl';

export default function ShortLinkTool({ open, onClose }) {
  const [input, setInput] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const resultRef = useRef(null);
  const titleId = useId();
  const statusId = useId();
  const normalizedUrl = normalizeShortLinkUrl(input);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    inputRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('input, button:not(:disabled), a[href]') || [])];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setInput('');
      setShortUrl('');
      setStatus('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const createLink = async (event) => {
    event.preventDefault();
    if (!normalizedUrl || submitting) return;
    setSubmitting(true);
    setShortUrl('');
    setStatus('Kurzlink wird erstellt …');
    try {
      const result = await createShortLink(normalizedUrl);
      const createdUrl = new URL(`/api/s/${result.code}`, window.location.origin).href;
      setShortUrl(createdUrl);
      setStatus('Der Kurzlink ist bereit.');
    } catch (error) {
      setStatus(error.response?.status === 400
        ? 'Bitte gib eine gültige HTTP- oder HTTPS-Adresse ein.'
        : 'Der Kurzlink konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setStatus('Kurzlink in die Zwischenablage kopiert.');
    } catch {
      resultRef.current?.select();
      const copied = document.execCommand('copy');
      setStatus(copied ? 'Kurzlink in die Zwischenablage kopiert.' : 'Kurzlink markieren und manuell kopieren.');
    }
  };

  return createPortal(
    <div className="lm-qr-tool-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="lm-qr-tool lm-short-link-tool" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="lm-qr-tool-header">
          <div>
            <span className="lm-qr-tool-eyebrow">Unterrichtstool</span>
            <h2 id={titleId}>Kurzlink erstellen</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Kurzlink-Tool schließen" title="Schließen">×</button>
        </header>
        <div className="lm-qr-tool-content">
          <p className="lm-short-link-intro">Erstelle einen dauerhaften, kurzen Link zu einer Unterrichtsseite.</p>
          <form className="lm-short-link-form" onSubmit={createLink}>
            <label htmlFor={`${titleId}-url`}>Unterrichtsadresse</label>
            <input
              ref={inputRef}
              id={`${titleId}-url`}
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck="false"
              placeholder="https://example.org/unterricht"
              value={input}
              onChange={(event) => { setInput(event.target.value); setShortUrl(''); setStatus(''); }}
              aria-describedby={statusId}
            />
            <button type="submit" disabled={!normalizedUrl || submitting}>{submitting ? 'Wird erstellt …' : 'Kurzlink erstellen'}</button>
          </form>
          <p id={statusId} className="lm-qr-tool-status" role="status" aria-live="polite">
            {status || (!input.trim() ? 'Füge eine HTTP- oder HTTPS-Adresse ein.' : !normalizedUrl ? 'Bitte eine gültige HTTP- oder HTTPS-Adresse eingeben.' : '')}
          </p>
          {shortUrl && (
            <div className="lm-short-link-result">
              <label htmlFor={`${titleId}-result`}>Dein Kurzlink</label>
              <div>
                <input ref={resultRef} id={`${titleId}-result`} readOnly value={shortUrl} onFocus={(event) => event.currentTarget.select()} />
                <button type="button" onClick={copyLink}>Kopieren</button>
              </div>
              <a href={shortUrl} target="_blank" rel="noopener noreferrer">Kurzlink öffnen</a>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
