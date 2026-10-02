import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeQrCodeUrl } from '../lib/qrCodeUrl';

export default function QrCodeTool({ open, onClose }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const url = normalizeQrCodeUrl(input);

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
      const controls = [...dialogRef.current.querySelectorAll('input, button:not(:disabled), a[href]')];
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
    if (!open || !url) return undefined;
    let cancelled = false;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, {
        width: 640,
        margin: 3,
        color: { dark: '#111827', light: '#ffffff' },
      }))
      .then((src) => { if (!cancelled) setResult({ url, src }); })
      .catch(() => { if (!cancelled) setResult({ url, error: true }); });
    return () => { cancelled = true; };
  }, [open, url]);

  if (!open) return null;

  const qrSrc = result?.url === url ? result.src : null;
  const generationFailed = result?.url === url && result.error;

  return createPortal(
    <div className="lm-qr-tool-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="lm-qr-tool" role="dialog" aria-modal="true" aria-labelledby="lm-qr-tool-title">
        <header className="lm-qr-tool-header">
          <div>
            <span className="lm-qr-tool-eyebrow">Unterrichtstool</span>
            <h2 id="lm-qr-tool-title">QR-Code-Generator</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="QR-Code-Generator schließen" title="Schließen">×</button>
        </header>
        <div className="lm-qr-tool-content">
          <label htmlFor="lm-qr-tool-url">Link eingeben oder einfügen</label>
          <input
            ref={inputRef}
            id="lm-qr-tool-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck="false"
            placeholder="https://example.org"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-describedby="lm-qr-tool-status"
          />
          <p id="lm-qr-tool-status" className="lm-qr-tool-status" role="status">
            {!input.trim() ? 'Der QR-Code erscheint automatisch, sobald du einen Link eingibst.'
              : !url ? 'Bitte einen gültigen http- oder https-Link eingeben.'
                : generationFailed ? 'Der QR-Code konnte nicht erstellt werden. Bitte einen kürzeren Link versuchen.'
                  : !qrSrc ? 'QR-Code wird erstellt …' : 'QR-Code bereit zum Scannen oder Herunterladen.'}
          </p>
          {qrSrc && (
            <div className="lm-qr-tool-result">
              <img src={qrSrc} alt={`QR-Code für ${url}`} />
              <a href={qrSrc} download="qr-code.png">QR-Code als PNG herunterladen</a>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
