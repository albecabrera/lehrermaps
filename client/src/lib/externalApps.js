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
  if (/^informatik 6[fd]$/.test(normalized)) return SCHEDULE_INFORMATIK_6_ONENOTE;
  if (normalized === 'spanisch 10bdf') return SCHEDULE_SPANISCH_10_ONENOTE;
  if (normalized === 'spanisch q2') return SCHEDULE_SPANISCH_Q2_ONENOTE;
  if (normalized === 'wp informatik 8abcdef') return SCHEDULE_WP_INFORMATIK_8_ONENOTE;
  return null;
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

export const SCHEDULE_SPANISCH_10_ONENOTE = {
  type: 'onenote',
  nativeUrl: 'onenote:https://d.docs.live.net/d4acb07aa3091664/Dokumente/Spanisch%2010/26-27-S-10/Unidad%201.one#Inhaltsverzeichnis&section-id={B28816B3-D30F-BE4A-A956-E0D146C3AA7E}&page-id={61FF38CE-96F6-7847-AC4B-8F41F1A6ACF7}&end',
  webUrl: 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21s6ff0b634b2154fdb85926ffdf0cbb518&id=documents&wd=target%2826-27-S-10%2FUnidad%201.one%7CB28816B3-D30F-BE4A-A956-E0D146C3AA7E%2FInhaltsverzeichnis%7C61FF38CE-96F6-7847-AC4B-8F41F1A6ACF7%2F%29&wdpartid={74F180FF-371B-DF44-8B2D-953AD1CD43EC}{1}&wdsectionfileid=D4ACB07AA3091664!scc75fde0e71a422eba30b97f9a83000f&end',
};

export const SCHEDULE_SPANISCH_Q2_ONENOTE = {
  type: 'onenote',
  nativeUrl: 'onenote:https://d.docs.live.net/D4ACB07AA3091664/Dokumente/Q2%20Español/26-27-S-Q2/UV5-Latinoamérica%20-%20retos%20y%20oportunidades%20de%20la%20diversidad%20étnica.one#Inhaltsverzeichnis&section-id={E2605677-E8C1-0843-A305-7ABB9497CED9}&page-id={21AB4A37-E55A-CB43-A823-445FB1687B86}&end',
  webUrl: 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21575&id=documents&wd=target%2826-27-S-Q2%2FUV5-Latinoam%C3%A9rica%20-%20retos%20y%20oportunidades%20de%20la%20diversidad%20%C3%A9tnica.one%7CE2605677-E8C1-0843-A305-7ABB9497CED9%2FInhaltsverzeichnis%7C21AB4A37-E55A-CB43-A823-445FB1687B86%2F%29&wdpartid={466DE105-269A-0249-B95A-3D2850F8A14E}{1}&wdsectionfileid=D4ACB07AA3091664!sc15d114dbb6d4fa2b891646ae5656c88&end',
};

export const SCHEDULE_WP_INFORMATIK_8_ONENOTE = {
  type: 'onenote',
  nativeUrl: 'onenote:https://d.docs.live.net/d4acb07aa3091664/Dokumente/WP8-Informatik/26-27-IF-WP8/Kapitel5-Automaten.one#Inhaltsverzeichnis&section-id={B75DA203-AB73-BE4A-91E3-C61A7FD385E0}&page-id={D99C7E7E-7D6C-5D4A-A26B-E39347862BF6}&end',
  webUrl: 'https://onedrive.live.com/view.aspx?resid=D4ACB07AA3091664%21scac53b33955c4c9989ae58fe8044acdf&id=documents&wd=target%2826-27-IF-WP8%2FKapitel5-Automaten.one%7CB75DA203-AB73-BE4A-91E3-C61A7FD385E0%2FInhaltsverzeichnis%7CD99C7E7E-7D6C-5D4A-A26B-E39347862BF6%2F%29&wdpartid={076C0CA6-4875-0B47-974C-99D510A3C3EF}{1}&wdsectionfileid=D4ACB07AA3091664!s7404bffcc52c4da988c4734f595a550c&end',
};
