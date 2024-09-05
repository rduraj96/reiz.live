export const iridescentVertexShader = `
  uniform float time;
  uniform float bassFrequency;
  uniform float trebleFrequency;
  uniform float radius;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vEyeVector;
  
  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Replicate visualizeBlob function
    vec3 pos = position;
    float noise = snoise(vec3(pos.x + time * 0.00007, pos.y + time * 0.00008, pos.z + time * 0.00009));
    float amp = 1.0;
    float displacement = (1.0 + noise * amp * trebleFrequency) * (1.0 + bassFrequency * 0.05);
    
    pos = normalize(pos) * (radius * displacement);
    
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vEyeVector = normalize(worldPosition.xyz - cameraPosition);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const iridescentFragmentShader = `
  uniform float time;
  uniform float rimLightIntensity;
  uniform float pulseIntensity;
  uniform float pulseSpeed;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vEyeVector;

  // Function to convert HSL to RGB
  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  // Function to create CD-like iridescent color
  vec3 cdColor(float angle) {
    // CD-like color spectrum
    vec3 a = vec3(0.50, 0.50, 0.50);
    vec3 b = vec3(0.50, 0.50, 0.50);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.00, 0.33, 0.67);

    return a + b * cos(6.28318 * (c * angle + d));
  }

  void main() {
    // Calculate the fresnel effect
    float fresnel = pow(1.0 - abs(dot(vNormal, -vEyeVector)), 3.0);
    
    // Use the fresnel effect and position to create a CD-like iridescent effect
    float angle = fresnel * 0.8 + dot(normalize(vPosition), vec3(1.0, 1.0, 1.0)) * 0.2 + time * 0.05;
    
    // Create the CD-like iridescent color
    vec3 iridescentColor = cdColor(angle);
    
    // Add some variation based on position
    float positionVariation = sin(vPosition.x * 10.0 + vPosition.y * 10.0 + vPosition.z * 10.0 + time) * 0.1;
    iridescentColor += vec3(positionVariation);

    // Lighting calculation
    vec3 lightDir = normalize(vec3(sin(time * 0.5), cos(time * 0.5), 0.5));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    
    // Spherical gradient for added depth
    float sphericalGradient = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5;

    // Combine lighting components
    vec3 finalColor = iridescentColor * (diffuse * 0.6 + 0.4);
    finalColor += vec3(1.0, 0.8, 0.6) * fresnel * rimLightIntensity;
    finalColor *= sphericalGradient;

    // Pulsing effect
    float pulse = sin(time * pulseSpeed) * 0.5 + 0.5;
    finalColor += iridescentColor * pulse * pulseIntensity;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
