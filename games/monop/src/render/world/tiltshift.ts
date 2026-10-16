import { Vector2 } from 'three';

/**
 * The miniature look. A real tilt-shift lens keeps one band of the picture sharp and blurs
 * towards the top and bottom, which the eye reads as a tiny model photographed up close. Two
 * passes (across, then down) blur each pixel by how far it sits from the band; the grade pass
 * then lifts saturation and contrast the way toy-photography prints do, with a soft vignette.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BLUR = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform vec2 direction;
  uniform float focus;
  uniform float band;
  uniform float ramp;
  uniform float maxBlur;
  varying vec2 vUv;

  void main() {
    float away = abs(vUv.y - focus);
    float amount = smoothstep(band, band + ramp, away);
    float radius = maxBlur * amount;
    if (radius < 0.35) {
      gl_FragColor = texture2D(tDiffuse, vUv);
      return;
    }
    vec2 stepUv = direction * radius / resolution / 4.0;
    vec4 sum = vec4(0.0);
    float total = 0.0;
    for (int i = -6; i <= 6; i++) {
      float f = float(i);
      float w = exp(-f * f / 18.0);
      sum += texture2D(tDiffuse, vUv + stepUv * f) * w;
      total += w;
    }
    gl_FragColor = sum / total;
  }
`;

const GRADE = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float saturation;
  uniform float contrast;
  uniform float vignette;
  uniform vec3 tint;
  varying vec2 vUv;

  void main() {
    vec4 colour = texture2D(tDiffuse, vUv);
    float grey = dot(colour.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 rgb = mix(vec3(grey), colour.rgb, saturation);
    rgb = (rgb - 0.18) * contrast + 0.18;
    rgb *= tint;
    vec2 centred = vUv - 0.5;
    float fall = smoothstep(0.85, 0.25, length(centred * vec2(1.0, 1.25)));
    rgb *= mix(1.0 - vignette, 1.0, fall);
    gl_FragColor = vec4(max(rgb, 0.0), colour.a);
  }
`;

export interface TiltShiftSettings {
  /** Where the sharp band sits, 0 at the bottom of the frame and 1 at the top. */
  focus: number;
  /** Half the height of the sharp band. */
  band: number;
  /** How far the blur takes to reach its full strength. */
  ramp: number;
  /** The strongest blur, in pixels at 1080 lines. */
  maxBlur: number;
}

export function blurShader(direction: [number, number], settings: TiltShiftSettings) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      resolution: { value: new Vector2(1920, 1080) },
      direction: { value: new Vector2(...direction) },
      focus: { value: settings.focus },
      band: { value: settings.band },
      ramp: { value: settings.ramp },
      maxBlur: { value: settings.maxBlur },
    },
    vertexShader: VERTEX,
    fragmentShader: BLUR,
  };
}

export interface GradeSettings {
  saturation: number;
  contrast: number;
  vignette: number;
  tint: [number, number, number];
}

export function gradeShader(settings: GradeSettings) {
  return {
    uniforms: {
      tDiffuse: { value: null },
      saturation: { value: settings.saturation },
      contrast: { value: settings.contrast },
      vignette: { value: settings.vignette },
      tint: { value: settings.tint },
    },
    vertexShader: VERTEX,
    fragmentShader: GRADE,
  };
}
