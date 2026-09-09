import { createPortal } from 'react-dom';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

export default function ConfirmModal({
  open, title, message, warning, onConfirm, onClose,
  confirmLabel, confirmColor = '#DC2626',
}) {
  const { t } = useLang();
  useEscapeKey(open, onClose);
  if (!open) return null;

  const label = confirmLabel || t('delete');

  return createPortal(
    <div
      className="lm-dialog-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        onClick={(e) => e.stopPropagation()}
        className="lm-modal-surface lm-confirm-dialog"
      >
        <div id="confirm-modal-title" className="lm-confirm-title">
          {title}
        </div>
        <div id="confirm-modal-message" className={warning ? 'lm-confirm-message has-warning' : 'lm-confirm-message'}>
          {message}
        </div>
        {warning && (
          <div className="lm-confirm-warning">
            ⚠ {warning}
          </div>
        )}
        <div className="lm-confirm-actions">
          <button
            onClick={onClose}
            className="lm-button lm-button-secondary"
          >{t('cancel')}</button>
          <button
            onClick={onConfirm}
            className="lm-button lm-confirm-primary"
            style={{ '--confirm-color': confirmColor }}
          >{label}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
