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
  ph?.capture(name, params);
}

// PostHog(인디 앱 공용 프로젝트). 키(VITE_POSTHOG_KEY)가 없으면 아무것도 불러오지 않는다 — GA4와 같은 규칙
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
let ph: import('posthog-js').PostHog | undefined;

export function initPosthog(): void {
  if (!PH_KEY || !/^phc_\w+$/.test(PH_KEY)) return;
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(PH_KEY, {
      api_host: 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: false,
      disable_session_recording: true,
    });
    posthog.register({ app: 'pulse', environment: import.meta.env.DEV ? 'staging' : 'production' });
    ph = posthog;
  });
}
