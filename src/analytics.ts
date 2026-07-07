import { Platform } from 'react-native';

// Privacy-light analytics: anonymous session id + event name + route, sent
// via sendBeacon to our own Cloud Run sink (Cloud Logging; no cookies, no
// third parties). Query: jsonPayload.kgb=true in the adk-coding-agents logs.
const BEACON = 'https://kgb-beacon-692247227248.us-central1.run.app/e';

let sid = '';
function sessionId(): string {
  if (sid) return sid;
  try {
    const st = window.sessionStorage;
    sid = st.getItem('kgb.sid') ?? Math.random().toString(36).slice(2, 12);
    st.setItem('kgb.sid', sid);
  } catch {
    sid = Math.random().toString(36).slice(2, 12);
  }
  return sid;
}

export function track(e: string, p: Record<string, string | number> = {}): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({
      e,
      p,
      sid: sessionId(),
      path: window.location.hash || '#/',
    });
    if (navigator.sendBeacon) navigator.sendBeacon(BEACON, body);
    else void fetch(BEACON, { method: 'POST', body, keepalive: true });
  } catch { /* analytics must never break play */ }
}
