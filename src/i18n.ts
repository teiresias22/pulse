const ko = {
  title: 'Pulse',
  tagline: '지난 7일, 지구의 맥박',
  live: '라이브',
  layer: { quake: '지진', storm: '태풍', fire: '산불', launch: '발사', iss: 'ISS' },
  retry: '다시 시도',
  loading: '불러오는 중',
  failed: '불러오지 못했어요',
  timeline: '타임라인',
  dataAgo: (ago: string) => `${ago} 데이터`,
  now: '지금',
  play: '재생',
  pause: '일시정지',
  speed: '배속',
  scrubTime: '시각',
  share: '링크 복사',
  copied: '복사됨',
  close: '닫기',
  magnitude: '규모',
  status: { success: '성공', failure: '실패', upcoming: '예정' },
  stormCat: { ts: '열대폭풍', c12: '1–2등급', c3: '3등급 이상' },
  issPosition: '현재 위치',
  altitude: '고도',
  estimated: '추정 위치(궤도 정보가 오래됨)',
  follow: 'ISS 따라가기',
  unfollow: '따라가기 멈춤',
  source: '원문 보기',
  legendTitle: '범례',
  noWebgl: '이 브라우저는 3D를 지원하지 않아요. 최근 기록만 목록으로 보여드려요.',
  recentQuakes: '최근 지진',
  upcomingLaunches: '예정 발사',
  minutes: (n: number) => `${n}분 전`,
  hours: (n: number) => `${n}시간 전`,
  days: (n: number) => `${n}일 전`,
};

const en: typeof ko = {
  title: 'Pulse',
  tagline: 'The planet’s pulse, last 7 days',
  live: 'Live',
  layer: { quake: 'Quakes', storm: 'Storms', fire: 'Wildfires', launch: 'Launches', iss: 'ISS' },
  retry: 'Retry',
  loading: 'Loading',
  failed: 'Failed to load',
  timeline: 'Timeline',
  dataAgo: (ago: string) => `Data from ${ago}`,
  now: 'Now',
  play: 'Play',
  pause: 'Pause',
  speed: 'Speed',
  scrubTime: 'Time',
  share: 'Copy link',
  copied: 'Copied',
  close: 'Close',
  magnitude: 'Magnitude',
  status: { success: 'Success', failure: 'Failure', upcoming: 'Upcoming' },
  stormCat: { ts: 'Tropical storm', c12: 'Category 1–2', c3: 'Category 3+' },
  issPosition: 'Current position',
  altitude: 'Altitude',
  estimated: 'Estimated (orbit data is old)',
  follow: 'Follow ISS',
  unfollow: 'Stop following',
  source: 'View source',
  legendTitle: 'Legend',
  noWebgl: 'This browser can’t show 3D. Here is the recent activity as a list.',
  recentQuakes: 'Recent quakes',
  upcomingLaunches: 'Upcoming launches',
  minutes: (n: number) => `${n} min ago`,
  hours: (n: number) => `${n} h ago`,
  days: (n: number) => `${n} d ago`,
};

export const lang = navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
export const msg = lang === 'ko' ? ko : en;

const local = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const utc = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export function fmtTime(ms: number): string {
  return `${local.format(ms)} (UTC ${utc.format(ms)})`;
}

export function fmtAgo(ms: number, now: number): string {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 60) return msg.minutes(min);
  if (min < 1440) return msg.hours(Math.round(min / 60));
  return msg.days(Math.round(min / 1440));
}

export function fmtCountdown(target: number, t: number): string {
  const sign = target >= t ? 'T−' : 'T+';
  let s = Math.floor(Math.abs(target - t) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  return `${sign}${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
