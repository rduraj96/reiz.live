// Liquid chrome blob: a raymarched SDF sphere whose surface carries the
// spectrum (bass at the equator, treble at the poles), kick shockwaves and a
// jelly squash. Ported from the reiz-mockups chrome-blob / tuner prototypes.
//
// Colour is written in display space, as in the prototype, so the shader skips
// the tonemapping/colorspace chunks on purpose. Output is premultiplied alpha;
// misses are fully transparent so the page shows through.

export const blobVertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const blobFragmentShader = /* glsl */ `
  uniform vec2 res;
  uniform float time, bass, mid, treb, snare, tune;
  uniform vec3 kickDir;
  uniform float kickAge, kickAmp, squash, flash;
  uniform sampler2D spec;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 iri(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  float sdf(vec3 p) {
    // jelly squash along the kick direction (volume-preserving-ish)
    float along = dot(p, kickDir);
    p += kickDir * along * squash * 0.35;
    p -= (p - kickDir * dot(p, kickDir)) * (-squash) * 0.15;
    vec3 n = normalize(p);
    // spectrum lookup: equator = bass, poles = treble, warped by slow noise so bands flow
    float f = n.y * n.y;
    f += 0.08 * snoise(n * 1.5 + vec3(0.0, time * 0.25, 0.0));
    f = clamp(f, 0.0, 1.0);
    float s = texture2D(spec, vec2(0.02 + f * 0.96, 0.5)).r;
    float lobes = 0.6 + 0.4 * snoise(n * 1.5 + vec3(time * 0.3, 0.0, time * 0.2));
    float d = length(p) - 0.92;
    d -= s * 0.17 * lobes;                                         // spectrum swell
    d -= bass * 0.06;                                              // overall breathe
    d -= 0.012 * (treb + tune * 2.6) * snoise(p * 4.2 + time * 1.4); // fine shimmer
    // kick shockwave rolling from kickDir across the surface
    float ang = acos(clamp(dot(n, kickDir), -1.0, 1.0));
    float ph = ang - kickAge * 4.2;
    d -= kickAmp * exp(-kickAge * 2.2) * exp(-ph * ph * 22.0) * 0.10;
    return d * 0.62;
  }

  vec3 nrm(vec3 p) {
    vec2 e = vec2(0.0025, 0.0);
    return normalize(vec3(
      sdf(p + e.xyy) - sdf(p - e.xyy),
      sdf(p + e.yxy) - sdf(p - e.yxy),
      sdf(p + e.yyx) - sdf(p - e.yyx)));
  }

  vec3 env(vec3 r) {
    float h = r.y * 0.5 + 0.5;
    vec3 c = mix(vec3(0.015), vec3(0.85), smoothstep(0.58, 0.96, h));
    c += vec3(1.0, 0.12, 0.28) * smoothstep(0.84, 1.0, dot(r, normalize(vec3(-0.8, 0.3, 0.4)))) * 1.6;
    c += vec3(0.2, 0.5, 1.0) * smoothstep(0.8, 1.0, dot(r, normalize(vec3(0.9, -0.2, 0.5)))) * 1.3;
    c += vec3(1.0) * smoothstep(0.97, 1.0, dot(r, normalize(vec3(0.2, 0.9, 0.6)))) * 2.0 * (0.4 + flash);
    return c;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
    vec3 ro = vec3(0.0, 0.0, 4.3);
    vec3 rd = normalize(vec3(uv, -1.35));
    float a = time * 0.22 + mid * 0.15;
    float ca = cos(a), sa = sin(a);
    mat2 rot = mat2(ca, -sa, sa, ca);
    float t = 0.0;
    bool hit = false;
    vec3 p;
    for (int i = 0; i < STEPS; i++) {
      p = ro + rd * t;
      p.xz = rot * p.xz;
      float d = sdf(p);
      if (d < 0.0012) { hit = true; break; }
      t += d;
      if (t > 9.0) break;
    }
    if (!hit) { gl_FragColor = vec4(0.0); return; }
    vec3 n = nrm(p);
    vec3 v = -rd;
    v.xz = rot * v.xz;
    float ndv = max(dot(n, v), 0.0);
    float fr = pow(1.0 - ndv, 3.0);
    vec3 r = reflect(-v, n);
    vec3 film = iri(ndv * 1.3 + time * 0.04 + mid * 0.45 + snare * 0.25);
    vec3 col = env(r) * mix(film, vec3(1.0), 0.22) + fr * film * 0.9;
    col *= 1.0 + flash * 0.35;
    col = mix(col, vec3(dot(col, vec3(0.33))) * 0.9, tune * 0.85);  // drain to grey
    float g = hash(gl_FragCoord.xy + fract(time * 17.0));
    col = mix(col, vec3(g), tune * 0.5);                           // frost over
    float edge = smoothstep(0.0, 0.06, ndv);                       // soft silhouette
    gl_FragColor = vec4(pow(col, vec3(0.92)) * edge, edge);
  }
`;
