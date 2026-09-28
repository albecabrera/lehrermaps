export function requestNativeRandomizerFullscreen({ element, documentRef = document, onNative, onFallback }) {
  if (!element?.requestFullscreen) {
    onFallback?.();
    return false;
  }

  try {
    // This call must remain synchronous with the user's click. Delaying it to a
    // timer or animation frame loses the browser's transient activation.
    const request = element.requestFullscreen();
    Promise.resolve(request).then(() => {
      if (documentRef.fullscreenElement === element) onNative?.();
      else onFallback?.();
    }).catch(() => onFallback?.());
    return true;
  } catch {
    onFallback?.();
    return false;
  }
}

export async function exitNativeRandomizerFullscreen({ element, documentRef = document }) {
  if (documentRef.fullscreenElement !== element || !documentRef.exitFullscreen) return false;
  try {
    await documentRef.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

export function closeRandomizerDisplayOnEscape(event, closeDisplay) {
  if (event.key !== 'Escape') return false;
  event.preventDefault();
  event.stopImmediatePropagation?.();
  closeDisplay();
  return true;
}
