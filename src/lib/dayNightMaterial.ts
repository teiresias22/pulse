import { ShaderMaterial, Vector3, type Texture } from 'three';
import { sunVector, type GeoPoint } from './sun.ts';

// three-globe는 지구 메시를 Y축 -90° 돌려 둔다 → 법선은 월드 공간으로 바꿔 태양 방향(월드)과 비교한다
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    float light = dot(normalize(vNormal), sunDirection);
    vec4 day = texture2D(dayTexture, vUv);
    vec4 night = texture2D(nightTexture, vUv);
    gl_FragColor = mix(night, day, smoothstep(-0.1, 0.1, light));
  }
`;

// 색 공간 규약: 셰이더에 colorspace_fragment가 없으므로 텍스처는 NoColorSpace로 둘 것(SRGBColorSpace를 주면 색이 바래거나 어두워진다)
export function createDayNightMaterial(day: Texture, night: Texture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      dayTexture: { value: day },
      nightTexture: { value: night },
      sunDirection: { value: new Vector3(0, 0, 1) },
    },
    vertexShader,
    fragmentShader,
  });
}

export function setSunDirection(material: ShaderMaterial, sun: GeoPoint): void {
  const [x, y, z] = sunVector(sun);
  (material.uniforms.sunDirection.value as Vector3).set(x, y, z);
}
