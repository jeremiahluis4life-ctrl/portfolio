/* ==========================================================
   WORK — "Ivory Tunnel" walk-through gallery
   Raw WebGL2. Scroll walks the camera down a curved tunnel,
   projects hang on the walls, drag to look, click to focus.
   Falls back to the HTML tiles when WebGL2 is unavailable.
   ========================================================== */
(() => {
  'use strict';
  const work = document.getElementById('work');
  const canvas = document.getElementById('tunnel');
  if (!work || !canvas) return;
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return;

  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- project data from the HTML tiles ---------- */
  const tiles = [...document.querySelectorAll('#track .tile[data-n]')];
  const P = tiles.map(t => ({
    n: t.dataset.n,
    title: $('h3', t).textContent.trim(),
    cat: $('.tile-cat', t).textContent.trim(),
    desc: $('p', t).textContent.trim(),
    tags: [...t.querySelectorAll('.tags li')].map(li => [li.textContent, li.classList.contains('hl')]),
    links: [...t.querySelectorAll('.tile-links a')].map(a => [a.getAttribute('href'), a.textContent.replace(/[↗→]/g, '').trim(), a.target === '_blank']),
    img: $('img', t).getAttribute('src'),
  }));
  const N = P.length;

  /* ---------- vector + matrix helpers ---------- */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mulS = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const persp = (fy, asp, n, f) => { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; };
  const lookAt = (e, c, up) => { const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; };
  const mul = (a, b) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
  const rotAxis = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a); return add(add(mulS(v, c), mulS(cross(k, v), s)), mulS(k, dot(k, v) * (1 - c))); };

  /* ---------- tunnel path + cross-section ---------- */
  const HW = 3.6, HH = 2.4, EXP = 2 / 4.6;           // half width, half height, squircle exponent
  const GAP = 10, S0 = 16;                             // spacing between panels, first panel
  const PW = 4.3, PH = PW * 720 / 1024;               // panel size (matches texture aspect)
  const SEND = S0 + (N - 1) * GAP + 22;
  const C = s => [Math.sin(s * .041) * 5.5 + Math.sin(s * .017 + 1) * 3, Math.sin(s * .029) * .5, -s];
  const frameAt = s => { const t = norm(sub(C(s + .5), C(s - .5))); const n = norm(cross(t, [0, 1, 0])); return { t, n, b: cross(n, t) }; };
  const section = th => { const c = Math.cos(th), s = Math.sin(th); return [Math.sign(c) * Math.pow(Math.abs(c), EXP), Math.sign(s) * Math.pow(Math.abs(s), EXP)]; };

  /* ---------- shaders ---------- */
  const tunVS = `#version 300 es
in vec3 aP;in vec2 aU;in vec2 aL;uniform mat4 uVP;out vec2 vU;out vec2 vL;out vec3 vW;
void main(){vU=aU;vL=aL;vW=aP;gl_Position=uVP*vec4(aP,1.);}`;
  const tunFS = `#version 300 es
precision highp float;
in vec2 vU;in vec2 vL;in vec3 vW;uniform vec3 uCam;uniform vec3 uBg;uniform float uDark;out vec4 o;
float grid(float x,float k){float w=fwidth(x);float f=abs(fract(x-.5)-.5);return 1.-smoothstep(0.,w*k,f);}
void main(){
  vec3 base=mix(vec3(.958,.953,.944),vec3(.010,.012,.020),uDark);
  vec3 lineC=mix(vec3(.52,.52,.55),vec3(.20,.42,1.),uDark);
  float floorM=smoothstep(-.86,-.97,vL.y);
  float ceilM=smoothstep(.86,.97,vL.y);
  float gx=grid(vU.x*22.,1.2),gy=grid(vU.y/.92,1.2),gm=grid(vU.y/9.2,1.6);
  float line=max(max(gx,gy),gm*.8);
  float corner=pow(abs(vL.x*vL.y),2.);
  vec3 col=base*(1.-corner*.14);
  col=mix(col,lineC,line*mix(.5,.32,floorM)*(1.-uDark*.4));
  col+=lineC*line*uDark*(.45+.5*gm);
  float ls=mod(vU.y+4.,10.)-5.;
  float lx=(vU.x-.25)*19.;
  vec2 q=vec2(lx/1.25,ls/1.9);
  float m=max(abs(q.x),abs(q.y));
  float inside=step(m,1.)*ceilM;
  float rim=smoothstep(.9,.93,m)*inside;
  float rings=.5+.5*cos(length(vec2(lx,ls*.66))*20.);
  vec3 lcA=mix(vec3(.99,.97,.9),vec3(.16,.32,.78),uDark);
  vec3 lcB=mix(vec3(.42,.4,.36),vec3(.015,.03,.08),uDark);
  col=mix(col,mix(lcA,lcB,smoothstep(.7,1.,rings)*.85),inside);
  col=mix(col,mix(vec3(.06),vec3(.5,.75,1.),uDark),rim);
  float d=length(vW-uCam);
  col=mix(col,uBg,smoothstep(10.,62.,d));
  o=vec4(col,mix(1.,mix(.84,.7,uDark),floorM));
}`;
  const panVS = `#version 300 es
in vec3 aP;in vec2 aU;uniform mat4 uVP;out vec2 vU;out vec3 vW;
void main(){vU=aU;vW=aP;gl_Position=uVP*vec4(aP,1.);}`;
  const panFS = `#version 300 es
precision highp float;
in vec2 vU;in vec3 vW;uniform sampler2D uTex;uniform float uHi;uniform float uRefl;uniform float uDark;uniform float uPlain;uniform float uOp;uniform vec3 uCam;uniform vec3 uBg;out vec4 o;
void main(){
  vec4 tc=texture(uTex,vec2(vU.x,1.-vU.y));vec3 col=tc.rgb;
  float e=min(min(vU.x,1.-vU.x)*1.42,min(vU.y,1.-vU.y));
  col=mix(col,mix(vec3(.06),vec3(.35,.6,1.),uDark),(1.-smoothstep(.006,.014,e))*(1.-uPlain));
  col+=uHi*.18*(1.-smoothstep(0.,.07,e));
  col=mix(col,col*1.04+.02,uHi);
  float d=length(vW-uCam);
  col=mix(col,uBg,smoothstep(10.,62.,d));
  float a=mix(1.,tc.a*uOp,uPlain);
  if(uRefl>0.)a=uRefl*pow(1.-vU.y,2.);
  o=vec4(col,a);
}`;
  const compile = (vs, fs) => {
    const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const nU = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nU; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return { p, u, a: n => gl.getAttribLocation(p, n) };
  };
  let tun, pan;
  try { tun = compile(tunVS, tunFS); pan = compile(panVS, panFS); } catch (e) { console.warn('tunnel:', e.message); return; }

  /* ---------- tunnel mesh ---------- */
  const RING = 112, STEP = .5, SA = -12;
  const rings = Math.ceil((SEND + 30 - SA) / STEP) + 1;
  const pos = new Float32Array(rings * (RING + 1) * 3), uv = new Float32Array(rings * (RING + 1) * 2), loc = new Float32Array(rings * (RING + 1) * 2);
  let vi = 0;
  for (let r = 0; r < rings; r++) {
    const s = SA + r * STEP, c = C(s), f = frameAt(s);
    for (let j = 0; j <= RING; j++) {
      const th = j / RING * Math.PI * 2, [sx, sy] = section(th);
      const p = add(c, add(mulS(f.n, sx * HW), mulS(f.b, sy * HH)));
      pos.set(p, vi * 3); uv.set([j / RING, s], vi * 2); loc.set([sx, sy], vi * 2); vi++;
    }
  }
  const idx = new Uint32Array((rings - 1) * RING * 6);
  let ii = 0;
  for (let r = 0; r < rings - 1; r++) for (let j = 0; j < RING; j++) {
    const a = r * (RING + 1) + j, b = a + RING + 1;
    idx.set([a, b, a + 1, a + 1, b, b + 1], ii); ii += 6;
  }
  const tunVAO = gl.createVertexArray();
  gl.bindVertexArray(tunVAO);
  const buf = (data, attr, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); if (attr >= 0) { gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, size, gl.FLOAT, false, 0, 0); } };
  buf(pos, tun.a('aP'), 3); buf(uv, tun.a('aU'), 2); buf(loc, tun.a('aL'), 2);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  /* ---------- panels ---------- */
  const panels = P.map((p, i) => {
    const s = S0 + i * GAP, side = i % 2 ? -1 : 1, f = frameAt(s), c0 = C(s);
    const center = add(add(c0, mulS(f.n, side * (HW - .08))), mulS(f.b, .2));
    const ux = side > 0 ? mulS(f.t, -1) : f.t;                    // image x runs left→right for the viewer
    const facing = mulS(f.n, -side);
    const corner = (u, v) => add(center, add(mulS(ux, (u - .5) * PW), mulS(f.b, (v - .5) * PH)));
    const quad = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    const floorPt = add(c0, mulS(f.b, -HH));
    const mirror = q => sub(q, mulS(f.b, 2 * dot(sub(q, floorPt), f.b)));
    const mk = refl => {
      const d = new Float32Array(30);
      quad.forEach(([u, v], k) => { const q = corner(u, v); d.set([...(refl ? mirror(q) : q), u, v], k * 5); });
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(pan.a('aP')); gl.vertexAttribPointer(pan.a('aP'), 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(pan.a('aU')); gl.vertexAttribPointer(pan.a('aU'), 2, gl.FLOAT, false, 20, 12);
      gl.bindVertexArray(null);
      return vao;
    };
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([236, 233, 226, 255]));
    return { i, s, side, center, ux, b: f.b, facing, vao: mk(false), rvao: mk(true), tex, hi: 0 };
  });

  /* end-of-tunnel message, printed into the room */
  const SIGN_S = S0 + (N - 1) * GAP + 14, SW = 7.2, SH = 3.6;
  const sign = (() => {
    const f = frameAt(SIGN_S), c = add(C(SIGN_S), mulS(f.b, .35));
    const d = new Float32Array(30);
    [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]].forEach(([u, v], k) => d.set([...add(c, add(mulS(f.n, (u - .5) * SW), mulS(f.b, (v - .5) * SH))), u, v], k * 5));
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(pan.a('aP')); gl.vertexAttribPointer(pan.a('aP'), 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(pan.a('aU')); gl.vertexAttribPointer(pan.a('aU'), 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return { vao, tex };
  })();
  const paintSign = () => {
    const dk = document.documentElement.dataset.theme === 'dark';
    const cv = document.createElement('canvas'); cv.width = 1440; cv.height = 720;
    const x = cv.getContext('2d');
    const ink = dk ? '#eef0f4' : '#111110', acc = dk ? '#7fb0ff' : '#8a6830', mute = dk ? '#8a90a0' : '#75726a';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '500 30px "Geist Mono", ui-monospace, monospace'; x.fillStyle = acc;
    x.letterSpacing = '8px'; x.fillText('END OF THE TUNNEL', 720, 120); x.letterSpacing = '0px';
    x.fillStyle = acc; x.fillRect(660, 172, 120, 2);
    x.font = '300 118px "Cormorant Garamond", Georgia, serif'; x.fillStyle = ink;
    x.fillText('Your project could', 720, 300);
    x.font = 'italic 300 118px "Cormorant Garamond", Georgia, serif'; x.fillStyle = acc;
    x.fillText('hang here next.', 720, 430);
    x.font = '500 26px "Geist Mono", ui-monospace, monospace'; x.fillStyle = mute;
    x.letterSpacing = '5px'; x.fillText('THANKS FOR WALKING THROUGH', 720, 580); x.letterSpacing = '0px';
    gl.bindTexture(gl.TEXTURE_2D, sign.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  const tunLabel = document.querySelector('.tun-label');
  const syncLabel = () => { if (tunLabel) tunLabel.textContent = (document.documentElement.dataset.theme === 'dark' ? 'Night tunnel' : 'Ivory tunnel') + ' · selected work'; };
  syncLabel();
  document.addEventListener('ojtheme', () => { syncLabel(); if (texturesStarted) paintSign(); });

  /* textures: screenshot + caption strip, drawn once fonts are ready */
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const paint = (pn, img) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 720;
    const x = cv.getContext('2d');
    const dk = isDark();
    pn.img = img || pn.img; img = pn.img;
    x.fillStyle = dk ? '#0b0d12' : '#fbfaf7'; x.fillRect(0, 0, 1024, 720);
    if (img) { const sc = Math.max(1024 / img.width, 640 / img.height); x.drawImage(img, (1024 - img.width * sc) / 2, 0, img.width * sc, img.height * sc); }
    x.fillStyle = dk ? '#0b0d12' : '#fbfaf7'; x.fillRect(0, 640, 1024, 80);
    x.fillStyle = dk ? 'rgba(90,140,255,.45)' : 'rgba(17,17,16,.12)'; x.fillRect(0, 640, 1024, 2);
    const p = P[pn.i];
    x.font = '500 22px "Geist Mono", ui-monospace, monospace'; x.fillStyle = dk ? '#7fb0ff' : '#8a6830'; x.textBaseline = 'middle';
    x.fillText(p.n, 32, 681);
    x.font = '400 38px "Cormorant Garamond", Georgia, serif'; x.fillStyle = dk ? '#eef0f4' : '#111110';
    x.fillText(p.title, 84, 679);
    x.font = '500 17px "Geist Mono", ui-monospace, monospace'; x.fillStyle = dk ? '#8a90a0' : '#75726a'; x.textAlign = 'right';
    x.fillText(p.cat.toUpperCase().slice(0, 40), 992, 681);
    gl.bindTexture(gl.TEXTURE_2D, pn.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    dirty = true;
  };
  let texturesStarted = false;
  const loadTextures = () => {
    if (texturesStarted) return; texturesStarted = true;
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      paintSign();
      panels.forEach(pn => { paint(pn, null); const im = new Image(); im.decoding = 'async'; im.onload = () => paint(pn, im); im.src = P[pn.i].img; });
    });
  };

  /* ---------- UI: HUD, now-playing pill, focus card ---------- */
  work.classList.add('is-3d');
  const elNow = $('#tunNow'), elNowN = $('#tunNowN'), elNowT = $('#tunNowT'), elNowC = $('#tunNowC');
  const elCount = $('#tunCount'), card = $('#tunCard');
  $('#tunTotal').textContent = String(N).padStart(2, '0');

  const fillCard = i => {
    const p = P[i];
    $('.tc-n', card).textContent = p.n + ' / ' + String(N).padStart(2, '0');
    $('.tc-cat', card).textContent = p.cat;
    $('.tc-title', card).textContent = p.title;
    $('.tc-desc', card).textContent = p.desc;
    const tags = $('.tc-tags', card); tags.textContent = '';
    p.tags.forEach(([t, hl]) => { const li = document.createElement('li'); li.textContent = t; if (hl) li.className = 'hl'; tags.appendChild(li); });
    const links = $('.tc-links', card); links.textContent = '';
    p.links.forEach(([href, text, ext]) => {
      const a = document.createElement('a'); a.href = href; a.textContent = text + ' ';
      if (ext) { a.target = '_blank'; a.rel = 'noopener'; }
      const ic = document.createElement('i'); ic.textContent = ext ? '↗' : '→'; a.appendChild(ic);
      if (!ext) a.addEventListener('click', () => unfocus());
      links.appendChild(a);
    });
  };

  /* ---------- state ---------- */
  let vw = innerWidth, vh = innerHeight, top = 0, dist = 1, scrollY = window.scrollY;
  let camS = 2, focusI = -1, fk = 0, fkT = 0, nearI = 0, hoverI = -1, dirty = true, inView = false;
  let yaw = 0, pitch = 0, dragYaw = 0, dragPitch = 0, mx = 0, my = 0, smx = 0, smy = 0;
  let eye = [0, 0, 0], fwd = [0, 0, -1], right = [1, 0, 0], up = [0, 1, 0];
  let FOV = 62 * Math.PI / 180, autoYaw = 0;
  const sStart = 3, sEnd = S0 + (N - 1) * GAP + 6;
  const lenis = () => window.__lenis || null;

  const measure = () => {
    vw = innerWidth; vh = innerHeight;
    FOV = (vw / vh < 1 ? 80 : 62) * Math.PI / 180;   // wider view on portrait phones
    const h = Math.round(vh * (1.6 + N * .62));
    work.style.height = h + 'px';
    top = work.getBoundingClientRect().top + window.scrollY;
    dist = Math.max(1, h - vh);
    const dpr = Math.min(devicePixelRatio || 1, vw < 700 ? 1.5 : 1.75);
    canvas.width = Math.round(canvas.clientWidth * dpr * q); canvas.height = Math.round(canvas.clientHeight * dpr * q);
    gl.viewport(0, 0, canvas.width, canvas.height);
    dirty = true;
  };
  let q = 1;

  const focusTarget = i => {
    const pn = panels[i];
    const wide = vw > 900;
    const camRight = cross(pn.facing.map(v => -v), pn.b);      // viewer's right when facing the panel
    const shift = wide ? mulS(camRight, PW * .42) : mulS(pn.b, -PH * .55);
    const target = add(pn.center, shift);
    const back = wide ? 4.3 : 8.6;
    return { eye: add(target, mulS(pn.facing, back)), look: target };
  };

  function focus(i) {
    if (i < 0 || i >= N) return;
    loadTextures();
    focusI = i; fkT = 1; fillCard(i);
    card.hidden = false; requestAnimationFrame(() => card.classList.add('open'));
    work.classList.add('focused');
    const L = lenis(); L && L.stop();
    // keep the walk position in sync so Esc returns you next to this panel
    const y = top + clamp((panels[i].s - 6 - sStart) / (sEnd - sStart), 0, 1) * dist;
    if (L) L.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    scrollY = y;
    setTimeout(() => $('.tc-close', card).focus({ preventScroll: true }), 50);
  }
  function unfocus() {
    if (focusI < 0) return;
    focusI = -1; fkT = 0;
    card.classList.remove('open');
    setTimeout(() => { if (focusI < 0) card.hidden = true; }, 500);
    work.classList.remove('focused');
    const L = lenis(); L && L.start();
  }
  $('.tc-close', card).addEventListener('click', unfocus);
  $('.tc-prev', card).addEventListener('click', () => focus((focusI - 1 + N) % N));
  $('.tc-next', card).addEventListener('click', () => focus((focusI + 1) % N));
  $('#tunOpen').addEventListener('click', () => focus(nearI));
  document.addEventListener('keydown', e => {
    if (focusI < 0) return;
    if (e.key === 'Escape') unfocus();
    else if (e.key === 'ArrowRight') focus((focusI + 1) % N);
    else if (e.key === 'ArrowLeft') focus((focusI - 1 + N) % N);
  });

  /* ---------- picking ---------- */
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -(((cy - r.top) / r.height) * 2 - 1);
    const th = Math.tan(FOV / 2), asp = r.width / r.height;
    const dir = norm(add(fwd, add(mulS(right, nx * th * asp), mulS(up, ny * th))));
    let best = -1, bt = 1e9;
    panels.forEach(pn => {
      const den = dot(dir, pn.facing); if (den >= -1e-4) return;
      const t = dot(sub(pn.center, eye), pn.facing) / den; if (t <= 0 || t > 60 || t > bt) return;
      const hit = sub(add(eye, mulS(dir, t)), pn.center);
      if (Math.abs(dot(hit, pn.ux)) <= PW / 2 && Math.abs(dot(hit, pn.b)) <= PH / 2) { best = pn.i; bt = t; }
    });
    return best;
  };

  /* ---------- input: drag to look, click to focus ---------- */
  let down = null;
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch, moved: false, id: e.pointerId, type: e.pointerType };
  });
  addEventListener('pointermove', e => {
    if (fine) { mx = e.clientX / vw * 2 - 1; my = e.clientY / vh * 2 - 1; }
    if (down && down.type === 'mouse') {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 5) { down.moved = true; canvas.classList.add('dragging'); }
      dragYaw = clamp(down.yaw - dx * .004, -1.1, 1.1);
      dragPitch = clamp(down.pitch - dy * .003, -.45, .45);
    }
    if (fine && inView && !down) {
      const h = e.target === canvas ? pick(e.clientX, e.clientY) : -1;
      if (h !== hoverI) { hoverI = h; canvas.style.cursor = h >= 0 ? 'pointer' : ''; }
    }
  }, { passive: true });
  addEventListener('pointerup', e => {
    if (!down) return;
    const moved = down.moved || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
    canvas.classList.remove('dragging');
    if (!moved && e.target === canvas) {
      const h = pick(e.clientX, e.clientY);
      if (h >= 0) focus(h); else if (focusI >= 0) unfocus();
    }
    down = null;
  });

  /* ---------- render ---------- */
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const BG_L = [.953, .945, .925], BG_D = [.006, .008, .014];
  let dark = isDark() ? 1 : 0;
  const BG = dark ? BG_D.slice() : BG_L.slice();
  document.addEventListener('ojtheme', () => { if (texturesStarted) panels.forEach(pn => paint(pn, pn.img || null)); dirty = true; });
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let last = performance.now(), frames = 0, acc = 0, tuned = 0;
  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (!inView) return;
    const L = lenis();
    scrollY = L ? L.scroll : window.scrollY;
    const p = clamp((scrollY - top) / dist, 0, 1);
    const sT = lerp(sStart, sEnd, p);
    const k = 1 - Math.pow(.001, dt / 1000);                 // frame-rate independent smoothing
    camS = lerp(camS, sT, reduced ? 1 : clamp(k * 3.2, 0, 1));
    fk = lerp(fk, fkT, clamp(k * 2.4, 0, 1));
    if (!down) { dragYaw *= 1 - clamp(k * 1.4, 0, 1); dragPitch *= 1 - clamp(k * 1.4, 0, 1); }
    smx = lerp(smx, mx, clamp(k * 2, 0, 1)); smy = lerp(smy, my, clamp(k * 2, 0, 1));
    // portrait screens: turn gently toward the next project so side panels come into view
    let ay = 0;
    if (vw / vh < 1) {
      let nb = null, bd = 1e9;
      panels.forEach(pn => { const d = pn.s - camS; if (d > 1.2 && d < bd) { bd = d; nb = pn; } });
      if (nb && bd < 15) ay = -nb.side * Math.atan2(HW * .95, bd) * .8 * clamp((15 - bd) / 7, 0, 1);
    }
    autoYaw = lerp(autoYaw, ay, clamp(k * 1.1, 0, 1));
    yaw = dragYaw + autoYaw * (1 - fk) - smx * .16 * (1 - fk); pitch = dragPitch - smy * .08 * (1 - fk);

    // walking camera
    const fr = frameAt(camS);
    const wEye = add(C(camS), mulS(fr.b, .1 + Math.sin(camS * .9) * .03));
    let wF = norm(sub(add(C(camS + 6), mulS(fr.b, -.05)), wEye));
    wF = rotAxis(wF, fr.b, yaw);
    wF = rotAxis(wF, norm(cross(wF, fr.b)), pitch);
    let lookP = add(wEye, mulS(wF, 6));
    eye = wEye;
    if (fk > .001 && (focusI >= 0 || fk > .01)) {
      const fi = focusI >= 0 ? focusI : (focus.lastI ?? 0);
      const ft = focusTarget(fi);
      const e2 = ease(clamp(fk, 0, 1));
      eye = mix3(wEye, ft.eye, e2);
      lookP = mix3(lookP, ft.look, e2);
    }
    if (focusI >= 0) focus.lastI = focusI;
    fwd = norm(sub(lookP, eye));
    right = norm(cross(fwd, [0, 1, 0]));
    up = cross(right, fwd);
    const asp = canvas.width / canvas.height;
    const vp = mul(persp(FOV, asp, .05, 90), lookAt(eye, lookP, [0, 1, 0]));

    // nearest panel ahead → HUD
    let ni = 0, nd = 1e9;
    panels.forEach(pn => { const d = Math.abs(pn.s - (camS + 7)); if (d < nd) { nd = d; ni = pn.i; } });
    if (ni !== nearI || !elNow.dataset.ready) {
      nearI = ni; elNow.dataset.ready = '1';
      const pp = P[ni];
      elNowN.textContent = pp.n; elNowT.textContent = pp.title; elNowC.textContent = pp.cat;
      elCount.textContent = pp.n;
      elNow.classList.remove('swap'); void elNow.offsetWidth; elNow.classList.add('swap');
    }
    work.classList.toggle('walking', p > .015);
    work.classList.toggle('at-end', p > .93);

    dark += ((isDark() ? 1 : 0) - dark) * clamp(k * 1.8, 0, 1);
    for (let c = 0; c < 3; c++) BG[c] = lerp(BG_L[c], BG_D[c], dark);
    gl.clearColor(BG[0], BG[1], BG[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 1) reflections (under the glossy floor)
    gl.useProgram(pan.p);
    gl.uniformMatrix4fv(pan.u.uVP, false, vp);
    gl.uniform3fv(pan.u.uCam, eye); gl.uniform3fv(pan.u.uBg, BG); gl.uniform1f(pan.u.uDark, dark);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pan.u.uTex, 0);
    gl.uniform1f(pan.u.uRefl, .55); gl.uniform1f(pan.u.uHi, 0); gl.uniform1f(pan.u.uPlain, 0); gl.uniform1f(pan.u.uOp, 1);
    panels.forEach(pn => { if (Math.abs(pn.s - camS) > 70) return; gl.bindTexture(gl.TEXTURE_2D, pn.tex); gl.bindVertexArray(pn.rvao); gl.drawArrays(gl.TRIANGLES, 0, 6); });
    // 2) tunnel (floor is translucent so reflections show)
    gl.useProgram(tun.p);
    gl.uniformMatrix4fv(tun.u.uVP, false, vp);
    gl.uniform3fv(tun.u.uCam, eye); gl.uniform3fv(tun.u.uBg, BG); gl.uniform1f(tun.u.uDark, dark);
    gl.bindVertexArray(tunVAO);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_INT, 0);
    // 3) panels
    gl.useProgram(pan.p);
    gl.uniform1f(pan.u.uRefl, 0);
    panels.forEach(pn => {
      const target = (pn.i === hoverI || pn.i === focusI) ? 1 : 0;
      pn.hi = lerp(pn.hi, target, clamp(k * 3, 0, 1));
      if (Math.abs(pn.s - camS) > 70) return;
      gl.uniform1f(pan.u.uHi, pn.hi);
      gl.bindTexture(gl.TEXTURE_2D, pn.tex); gl.bindVertexArray(pn.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    });
    const signOp = clamp((camS - (sEnd - 16)) / 10, 0, 1);
    if (signOp > .01) {
      gl.uniform1f(pan.u.uPlain, 1); gl.uniform1f(pan.u.uOp, signOp); gl.uniform1f(pan.u.uHi, 0);
      gl.depthMask(false);
      gl.bindTexture(gl.TEXTURE_2D, sign.tex); gl.bindVertexArray(sign.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
    }
    gl.bindVertexArray(null);

    // adaptive resolution for slow GPUs
    if (tuned < 3 && dt < 100) {
      acc += dt; frames++;
      if (frames === 45) { if (acc / frames > 21 && q > .55) { q *= .8; measure(); } else tuned = 3; tuned++; frames = 0; acc = 0; }
    }
  };

  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) loadTextures();
  }, { rootMargin: '600px 0px' }).observe(work);

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); work.classList.remove('is-3d'); });
  measure();
  requestAnimationFrame(frame);
})();
