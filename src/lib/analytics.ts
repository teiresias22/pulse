// GA4. 측정 ID(VITE_GA_ID)가 없으면 아무것도 불러오지 않는다(로컬 개발·포크 빌드)
const ID = import.meta.env.VITE_GA_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (!ID || !/^G-[A-Z0-9]+$/.test(ID)) return;
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js 는 배열이 아니라 arguments 객체를 그대로 받아야 한다
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.appendChild(s);
}

export function track(name: string, params?: Record<string, string | number | boolean>): void {
  window.gtag?.('event', name, params);
}
