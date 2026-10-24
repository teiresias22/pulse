export type GeoPoint = { lat: number; lng: number };

const RAD = Math.PI / 180;
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

// 시각 t(ms)에 태양이 머리 위에 있는 지점. NOAA 태양 위치 근사식(오차 1분각 안팎)
export function subsolarPoint(t: number): GeoPoint {
  const T = (t / 86_400_000 + 2_440_587.5 - 2_451_545) / 36_525; // J2000 기준 율리우스 세기
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360; // 평균 경도
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T); // 평균 이각
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD); // 겉보기 황경
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD); // 황도 경사
  const lat = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const eot =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD)); // 균시차(분)
  const utcHours = (((t % 86_400_000) + 86_400_000) % 86_400_000) / 3_600_000;
  return { lat, lng: wrapLng(-15 * (utcHours - 12) - eot / 4) };
}

export function antipode(p: GeoPoint): GeoPoint {
  return { lat: -p.lat, lng: wrapLng(p.lng + 180) };
}

// three-globe polar2Cartesian과 같은 규약의 단위 벡터(월드 좌표)
export function sunVector(p: GeoPoint): [number, number, number] {
  const phi = (90 - p.lat) * RAD;
  const theta = (90 - p.lng) * RAD;
  return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}
