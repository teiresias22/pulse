const ko = {
  title: 'Pulse',
  tagline: '지난 7일, 지구의 맥박',
  live: '라이브',
  layer: { quake: '지진', storm: '태풍', tornado: '토네이도', fire: '산불', launch: '발사', sat: '위성', aurora: '오로라', animal: '동물' },
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
  tornadoLegend: '토네이도 경보(미국)',
  auroraLegend: '오로라 띠(Kp 근사)',
  animalLegend: '최근 7일 관찰(iNaturalist)',
  animalGroup: { bear: '곰', elephant: '코끼리', bigcat: '대형 고양이', penguin: '펭귄', turtle: '바다거북', seal: '물범·바다사자', whale: '고래·돌고래' },
  animalCount: (n: number) => `${n}건`,
  andMore: (n: number) => `외 ${n}건`,
  obscured: '위치 흐림',
  animalNote: '최근 7일 iNaturalist 검증 관찰이에요. 최근 1–2일은 검증이 덜 돼 적게 보일 수 있어요.',
  wind: '최대 풍속',
  category: '등급',
  lastFix: '마지막 관측',
  stormInactive: '이 시각에는 관측이 없어요',
  area: '면적',
  ongoing: '진행 중',
  contained: '진화',
  region: '지역',
  inEffect: '발효',
  until: '종료',
  kpIndex: 'Kp 지수',
  kpKind: { observed: '관측', estimated: '추정', predicted: '예보' },
  gScale: '지자기폭풍 등급',
  none: '없음',
  noKp: '이 시각의 Kp 자료가 없어요',
  auroraVisible: (lat: number) => `자기위도 약 ${lat}° 이상에서 보일 수 있어요`,
  auroraApprox: 'Kp 지수로 그린 근사 띠예요. 실제 오로라 분포와 다를 수 있어요.',
  issPosition: '현재 위치',
  altitude: '고도',
  estimated: '추정 위치(궤도 정보가 오래됨)',
  follow: '따라가기',
  unfollow: '따라가기 멈춤',
  station: '정거장',
  satellite: '위성',
  period: '공전 주기',
  minutesUnit: '분',
  inclination: '궤도 경사',
  docked: '도킹 중',
  satNoPos: '이 시각의 위치를 계산하지 못했어요',
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
  layer: { quake: 'Quakes', storm: 'Storms', tornado: 'Tornadoes', fire: 'Wildfires', launch: 'Launches', sat: 'Satellites', aurora: 'Aurora', animal: 'Wildlife' },
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
  tornadoLegend: 'Tornado warning (US)',
  auroraLegend: 'Aurora band (Kp estimate)',
  animalLegend: 'Sightings, last 7 days (iNaturalist)',
  animalGroup: { bear: 'Bears', elephant: 'Elephants', bigcat: 'Big cats', penguin: 'Penguins', turtle: 'Sea turtles', seal: 'Seals & sea lions', whale: 'Whales & dolphins' },
  animalCount: (n: number) => `${n} sighting${n === 1 ? '' : 's'}`,
  andMore: (n: number) => `+${n} more`,
  obscured: 'location obscured',
  animalNote: 'Research-grade iNaturalist sightings from the last 7 days. The last 1–2 days may be undercounted while identifications come in.',
  wind: 'Max wind',
  category: 'Category',
  lastFix: 'Last fix',
  stormInactive: 'No fix at this time',
  area: 'Area',
  ongoing: 'Ongoing',
  contained: 'Contained',
  region: 'Areas',
  inEffect: 'In effect',
  until: 'Until',
  kpIndex: 'Kp index',
  kpKind: { observed: 'Observed', estimated: 'Estimated', predicted: 'Forecast' },
  gScale: 'Geomagnetic storm',
  none: 'None',
  noKp: 'No Kp data for this time',
  auroraVisible: (lat: number) => `May be visible poleward of ~${lat}° magnetic latitude`,
  auroraApprox: 'An approximate band drawn from the Kp index; the real aurora may differ.',
  issPosition: 'Current position',
  altitude: 'Altitude',
  estimated: 'Estimated (orbit data is old)',
  follow: 'Follow',
  unfollow: 'Stop following',
  station: 'Space station',
  satellite: 'Satellite',
  period: 'Orbital period',
  minutesUnit: 'min',
  inclination: 'Inclination',
  docked: 'Docked',
  satNoPos: 'Position unavailable at this time',
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

const dayFmt = new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', timeZone: 'UTC' });

export function fmtDay(ms: number): string {
  return dayFmt.format(ms);
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
