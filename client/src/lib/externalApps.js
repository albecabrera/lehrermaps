export const ONE_NOTE_WEB_URL = 'https://onedrive.live.com/personal/d4acb07aa3091664/_layouts/15/Doc.aspx?sourcedoc={a3091664-b07a-20ac-80d4-3f0200000000}&action=edit&wd=target%281.%20El%20desaf%C3%ADo%20de%20la%20pobreza%20infantil.one%7C6d614f90-05d1-4475-8443-f0fa2781b5ee%2F2024.11.05%7Ccffc2055-e788-1e45-ae5c-52cef29d8d5e%2F%29&wdorigin=NavigationUrl';

// The OneNote URI scheme asks the operating system to open the installed
// OneNote client instead of loading the notebook in the browser.
export const ONE_NOTE_APP_URL = `onenote:${ONE_NOTE_WEB_URL}`;

// The iDoceo URI scheme opens the installed iDoceo application.
export const IDOCEO_APP_URL = 'idoceo://';

export const WEB_UNTIS_URL = 'https://esg.webuntis.com/WebUntis/?school=esg#/basic/login';

export const SCHEDULE_INFORMATIK_6_ONENOTE = {
  type: 'onenote',
  nativeUrl: 'onenote:https://d.docs.live.net/D4ACB07AA3091664/Dokumente/Informatik%20Jgst%206/26-27-IF-6/0.%20Grundlagen.one#Inhaltsverzeichnis&section-id={167BE046-557E-4F49-87A3-81561BF72359}&page-id={CC51E7DE-5DBA-2A43-ABFE-52846D0BBE24}&end',
  webUrl: 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21585&id=documents&wd=target%2826-27-IF-6%2F0.%20Grundlagen.one%7C167BE046-557E-4F49-87A3-81561BF72359%2FInhaltsverzeichnis%7CCC51E7DE-5DBA-2A43-ABFE-52846D0BBE24%2F%29&wdpartid={67D22697-753B-A300-23D4-AEC8983224BB}{1}&wdsectionfileid=D4ACB07AA3091664!596&end',
};

export function scheduleOneNoteTarget(label) {
  const normalized = String(label || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLocaleLowerCase('de-DE');
  return /^informatik 6[fd]$/.test(normalized) ? SCHEDULE_INFORMATIK_6_ONENOTE : null;
}

/** Attempts the native handler once, then opens web only if this page stays visible. */
export function openOneNoteWithFallback(target, { windowRef = window, documentRef = document, delay = 750 } = {}) {
  let completed = false;
  let timer = null;
  const cleanup = () => {
    if (timer !== null) windowRef.clearTimeout(timer);
    documentRef.removeEventListener?.('visibilitychange', onPageHidden);
    windowRef.removeEventListener?.('pagehide', onPageHidden);
  };
  const onPageHidden = (event) => {
    if (event?.type !== 'pagehide' && documentRef.visibilityState !== 'hidden') return;
    completed = true;
    cleanup();
  };
  documentRef.addEventListener?.('visibilitychange', onPageHidden);
  windowRef.addEventListener?.('pagehide', onPageHidden, { once: true });
  windowRef.location.href = target.nativeUrl;
  timer = windowRef.setTimeout(() => {
    if (!completed && documentRef.visibilityState === 'visible') windowRef.open(target.webUrl, '_blank', 'noopener,noreferrer');
    cleanup();
  }, delay);
}
