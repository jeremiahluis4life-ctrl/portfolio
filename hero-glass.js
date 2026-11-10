/* ==========================================================
   HERO — the page shattered into thick smoked-glass shards.
   three.js 0.169 · MeshPhysicalMaterial · live cut pattern.
   The HTML in #ghBlock is painted onto the shards and kept as
   an invisible, selectable text layer via a homography.
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hero = document.getElementById('top');
const canvas = document.getElementById('glass');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (hero && canvas && !reduced) init().catch(e => console.warn('glass hero disabled:', e));

async function init() {
  const $ = s => hero.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const easeIn = t => t * t * t;
  const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const elBlock = $('#ghBlock'), elNav = $('#ghNav'), elPanel = $('#ghPanel');
  const elTerms = $('#ghTerms'), elBack = $('#ghBack'), elRead = $('#ghRead');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch { return; }
  const phoneDev = Math.min(innerWidth, innerHeight) < 700;
  // sharp on high-density phone screens; never drops below dprFloor
  let dprCap = Math.min(devicePixelRatio || 1, phoneDev ? 2.5 : 2);
  const dprFloor = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dprCap);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x050507, 1);   // replaced by applyTheme() once materials exist

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .42;
  const key = new THREE.DirectionalLight(0xeaf0ff, 1.25);
  key.position.set(-1, 1.25, 1.35);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe0b5, 0);
  rim.position.set(1.1, -.7, .55);
  scene.add(rim);
  let fxBack = null, fxShadow = null, fxShadowOp = 0;
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 10000);
  const block = new THREE.Group();
  scene.add(block);

  await (document.fonts ? Promise.all([document.fonts.load('500 40px Inter'), document.fonts.load('600 20px Inter'), document.fonts.load('400 16px Inter')]).catch(() => {}) : 0);

  /* ---------------- materials ---------------- */
  const glowU = { uPtr: { value: new THREE.Vector3(1e6, 1e6, 0) }, uGlow: { value: 0 }, uR: { value: 300 } };
  const isLight = () => document.documentElement.dataset.theme !== 'dark';
  const TH = {
    dark: { bg: new THREE.Color(0x050507), glass: new THREE.Color(0x17171b), env: .42 },
    light: { bg: new THREE.Color(0xe2dfd8), glass: new THREE.Color(0xf5f7fc), env: .88 },
  };
  let lightT = isLight() ? 1 : 0;
  const allGlass = [], tmpC = new THREE.Color();
  const applyTheme = () => {
    renderer.setClearColor(tmpC.lerpColors(TH.dark.bg, TH.light.bg, lightT), 1);
    scene.environmentIntensity = TH.dark.env + (TH.light.env - TH.dark.env) * lightT;
    allGlass.forEach(m => {
      m.color.lerpColors(TH.dark.glass, TH.light.glass, lightT);
      m.transmission = lightT > .02 ? .94 * lightT : 0;     // real refraction in light mode
      m.thickness = 72 * S; m.ior = 1.5;
      m.attenuationColor.setRGB(.86, .9, 1); m.attenuationDistance = 260 * S;
      m.roughness = .36 - .14 * lightT;
      m.clearcoat = .7 + .3 * lightT; m.clearcoatRoughness = .12 - .07 * lightT;
      m.specularIntensity = .7 + .3 * lightT;
    });
    key.intensity = 1.25 + .7 * lightT;
    rim.intensity = .9 * lightT;
    if (fxBack) { fxBack.visible = lightT > .01; fxBack.material.color.setScalar(lightT); }
  };
  const glassMat = (glow, irid = .55) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x17171b, roughness: .36, metalness: 0, clearcoat: .7, clearcoatRoughness: .12, specularIntensity: .7,
      iridescence: irid, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 650], envMapIntensity: 1,
    });
    if (glow) {
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, glowU);
        sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform vec3 uPtr;\nuniform float uGlow;\nuniform float uR;\nvarying vec3 vGW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  { float gd = distance(vGW.xy, uPtr.xy) / uR; totalEmissiveRadiance += vec3(.42, .37, .62) * .16 * uGlow * exp(-1.6 * gd * gd); }');
      };
      m.customProgramCacheKey = () => 'oj-glass-glow';
    }
    allGlass.push(m);
    return m;
  };

  /* ---------------- printed content (DOM → canvas) ---------------- */
  const makePrint = () => {
    const cv = document.createElement('canvas');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
    return { cv, ctx: cv.getContext('2d'), tex, mat };
  };
  const navPrint = makePrint(), panelPrint = makePrint();
  const tc = c => {
    if (!isLight() || !c) return c;
    const w = c.match(/rgba\(255,\s*255,\s*255,\s*([\d.]+)\)/);
    if (w) return 'rgba(18,18,22,' + Math.min(1, +w[1] * 1.3).toFixed(2) + ')';
    if (c.includes('200,169,110')) return 'rgba(138,104,48,.95)';
    if (/^#(f2f2f4|e8e8ec|ffffff|fff)$/i.test(c)) return '#121216';
    return c;
  };
  const relRect = (el, root) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const hovered = new Set();
  const paint = (root, pr, w, h) => {
    const dpr = Math.max(1.5, Math.min(devicePixelRatio || 1, 3));
    pr.cv.width = Math.max(2, Math.round(w * dpr)); pr.cv.height = Math.max(2, Math.round(h * dpr));
    const x = pr.ctx;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    root.querySelectorAll('[data-paint]').forEach(el => {
      if (!el.offsetParent && el !== root) return;
      const kind = el.dataset.paint;
      const r = relRect(el, root);
      const cs = getComputedStyle(el);
      const hov = hovered.has(el);
      if (kind === 'mark') return;
      if (kind === 'dot') {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad * 3.2);
        g.addColorStop(0, 'rgba(54,214,126,.45)'); g.addColorStop(1, 'rgba(54,214,126,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad * 3.2, 0, 7); x.fill();
        x.fillStyle = '#36d67e'; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
        return;
      }
      if (kind === 'pill') {
        x.fillStyle = hov ? '#36d67e' : (isLight() ? '#141418' : '#ececf0');
        x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 7 * S); x.fill();
        x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; x.letterSpacing = '0px';
        x.fillStyle = isLight() && !hov ? '#f4f4f6' : '#0b0b0d'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(el.textContent.trim(), r.x + r.w / 2, r.y + r.h / 2 + .5);
        x.textAlign = 'left';
        return;
      }
      x.font = `${cs.fontStyle === 'italic' ? 'italic ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      x.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      x.textBaseline = 'middle';
      const txt = cs.textTransform === 'uppercase' ? el.textContent.trim().toUpperCase() : el.textContent.trim();
      const ty = r.y + r.h / 2 + parseFloat(cs.fontSize) * .04;
      if (kind === 'grad') {
        const g = x.createLinearGradient(0, r.y, 0, r.y + r.h);
        if (isLight()) { g.addColorStop(0, '#1d1d22'); g.addColorStop(1, '#4a4a53'); } else { g.addColorStop(0, '#dcdce0'); g.addColorStop(1, '#bdbdc3'); }
        x.fillStyle = g;
      } else x.fillStyle = tc(hov && el.dataset.hover ? el.dataset.hover : el.dataset.color || '#fff');
      const pad = parseFloat(cs.paddingLeft) || 0;
      x.fillText(txt, r.x + pad, ty);
      if (el.dataset.underline && hov) {
        const tw = x.measureText(txt).width;
        x.fillRect(r.x + pad, ty + parseFloat(cs.fontSize) * .62, tw, Math.max(1, S * 1.4));
      }
    });
    // nav mark (square logo)
    const mark = root.querySelector('.gh-sq');
    if (mark) {
      const r = relRect(mark, root);
      const g = x.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      if (isLight()) { g.addColorStop(0, '#2b2b31'); g.addColorStop(1, '#0e0e11'); } else { g.addColorStop(0, '#ececf1'); g.addColorStop(1, '#8e8e97'); }
      x.fillStyle = g; x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, r.w * .26); x.fill();
      x.fillStyle = isLight() ? '#e3cf9f' : '#121215'; x.font = `italic 500 ${r.h * .52}px "Cormorant Garamond", Georgia, serif`;
      x.textAlign = 'center'; x.fillText('oj', r.x + r.w / 2, r.y + r.h * .54); x.textAlign = 'left';
    }
    pr.tex.needsUpdate = true;
  };
  const repaint = () => { paint(elNav, navPrint, L.bw, L.navH); paint(elPanel, panelPrint, L.pw, L.ph); };
  elBlock.querySelectorAll('a, button').forEach(el => {
    const targets = el.matches('[data-paint]') ? [el] : [...el.querySelectorAll('[data-paint]')];
    if (!targets.length) return;
    el.addEventListener('pointerenter', () => { targets.forEach(t => hovered.add(t)); repaint(); });
    el.addEventListener('pointerleave', () => { targets.forEach(t => hovered.delete(t)); repaint(); });
  });

  /* ---------------- layout ---------------- */
  let W = 1, H = 1, S = 1;
  const L = {};
  const layout = () => {
    W = hero.clientWidth; H = hero.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(15)));
    camera.near = 10; camera.far = camera.position.z * 5;
    camera.updateProjectionMatrix();
    const phone = W < 700;
    const mx = phone ? 16 : W * .055, my = phone ? 16 : H * .085;
    L.bw = W - mx * 2; L.bh = H - my * 2;
    S = Math.max(L.bw / 1730, .42);
    L.navH = phone ? Math.max(54, L.bh * .085) : L.bh * .108;
    L.gap = 14;
    L.left = -W / 2 + mx; L.top = H / 2 - my;
    L.px = L.left; L.pw = L.bw;
    L.pTop = L.top - L.navH - L.gap; L.ph = L.bh - L.navH - L.gap;
    L.portrait = W / H < .85;
    L.D = 13 * S; L.bev = 2.6 * S; L.r = 20 * S;
    L.printZ = L.D + L.bev + .6;
    glowU.uR.value = 300 * S;
    // DOM text layer sizes
    elBlock.style.setProperty('--S', S.toFixed(4));
    elBlock.style.setProperty('--h1', Math.min(L.pw * (L.portrait ? .15 : .078), L.ph * .2).toFixed(1) + 'px');
    elNav.style.width = L.bw + 'px'; elNav.style.height = L.navH + 'px';
    elPanel.style.width = L.pw + 'px'; elPanel.style.height = L.ph + 'px';
    buildNav(); buildSliver(); buildMe(); buildFx(); buildCells(performance.now() / 1000, true);
    repaint();
  };

  /* ---------------- geometry helpers ---------------- */
  const insetPoly = (poly, d) => {
    const n = poly.length; let area = 0;
    for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    const sg = area > 0 ? 1 : -1;
    const lines = poly.map((p, i) => {
      const q = poly[(i + 1) % n]; let dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      return { p: [p[0] - dy * sg * d, p[1] + dx * sg * d], d: [dx, dy] };
    });
    return lines.map((b, i) => {
      const a = lines[(i - 1 + n) % n];
      const cr = a.d[0] * b.d[1] - a.d[1] * b.d[0];
      if (Math.abs(cr) < 1e-6) return b.p;
      const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / cr;
      return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t];
    });
  };
  const roundedShape = (poly, r, ox, oy) => {
    const sh = new THREE.Shape(); const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p = poly[i], a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const rr = Math.min(r, la * .45, lb * .45);
      const p1 = [p[0] + (a[0] - p[0]) / la * rr - ox, p[1] + (a[1] - p[1]) / la * rr - oy];
      const p2 = [p[0] + (b[0] - p[0]) / lb * rr - ox, p[1] + (b[1] - p[1]) / lb * rr - oy];
      if (i === 0) sh.moveTo(p1[0], p1[1]); else sh.lineTo(p1[0], p1[1]);
      sh.quadraticCurveTo(p[0] - ox, p[1] - oy, p2[0], p2[1]);
    }
    sh.closePath();
    return sh;
  };
  const centroid = poly => { let x = 0, y = 0; poly.forEach(p => { x += p[0]; y += p[1]; }); return [x / poly.length, y / poly.length]; };
  const extrude = (shape, D, bev) => new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 5 });
  const printGeo = (shape, ox, oy, rect) => {
    const g = new THREE.ShapeGeometry(shape, 7);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + ox - rect.x) / rect.w, (pos.getY(i) + oy - (rect.y - rect.h)) / rect.h);
    uv.needsUpdate = true;
    return g;
  };

  /* ---------------- pieces ---------------- */
  const pieces = [];   // [nav, A, B, C, D, E]
  const mkPiece = (isNav) => {
    const mat = glassMat(true);
    const glass = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    const print = new THREE.Mesh(new THREE.BufferGeometry(), isNav ? navPrint.mat : panelPrint.mat);
    print.renderOrder = 2;
    const g = new THREE.Group(); g.add(glass, print); block.add(g);
    const p = { isNav, g, glass, print, mat, pivot: [0, 0], half: [1, 1], z: 0, vz: 0, rx: 0, vrx: 0, ry: 0, vry: 0, h: 0, vh: 0,
      fly: { v: [0, 0, 0], axis: new THREE.Vector3(0, 0, 1), ang: 0, delay: 0 } };
    glass.userData.piece = p;
    pieces.push(p);
    return p;
  };
  const navPiece = mkPiece(true);
  const cells = Array.from({ length: 5 }, () => mkPiece(false));

  const setGeo = (p, poly, rect) => {
    const c = p.pivotFixed || centroid(poly);
    p.pivot = c;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    poly.forEach(([x, y]) => { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); });
    p.half = [(maxx - minx) / 2, (maxy - miny) / 2];
    const sh = roundedShape(poly, L.r, c[0], c[1]);
    p.glass.geometry.dispose(); p.glass.geometry = extrude(sh, L.D, L.bev);
    p.print.geometry.dispose(); p.print.geometry = printGeo(sh, c[0], c[1], rect);
    p.print.position.z = L.printZ;
  };
  const buildNav = () => {
    const x0 = L.left, y0 = L.top, x1 = L.left + L.bw, y1 = L.top - L.navH;
    navPiece.pivotFixed = [(x0 + x1) / 2, (y0 + y1) / 2];
    setGeo(navPiece, insetPoly([[x0, y1], [x1, y1], [x1, y0], [x0, y0]], 0), { x: x0, y: y0, w: L.bw, h: L.navH });
  };

  /* live cut pattern (panel-normalised, x right, y down) */
  const BASE = { tAB: [.22, 0], tBC: [.515, 0], tCE: [.84, 0], bAD: [.34, 1], bDE: [.865, 1], J0: [.385, .72], J1: [.48, .62], J2: [.716, .49] };
  const KIND = { tAB: 't', tBC: 't', tCE: 't', bAD: 'b', bDE: 'b', J0: 'j', J1: 'j', J2: 'j' };
  const FIX = { TL: [0, 0], TR: [1, 0], BL: [0, 1], BR: [1, 1] };
  const PH = {}; Object.keys(BASE).forEach((k, i) => { PH[k] = [rnd(0, 6.28), rnd(0, 6.28), 10 + (i * 37 % 10), 11 + (i * 53 % 9)]; });
  const CELLS = [['TL', 'tAB', 'J0', 'bAD', 'BL'], ['tAB', 'tBC', 'J1', 'J0'], ['tBC', 'tCE', 'J2', 'J1'], ['J0', 'J1', 'J2', 'bDE', 'bAD'], ['tCE', 'TR', 'BR', 'bDE', 'J2']];
  let ptrPattern = null;
  const patternPoints = t => {
    const out = { ...FIX };
    for (const k in BASE) {
      let [x, y] = BASE[k]; const [p1, p2, T1, T2] = PH[k];
      x += .03 * Math.sin(t * 6.2832 / T1 + p1);
      if (KIND[k] === 'j') y += .05 * Math.sin(t * 6.2832 / T2 + p2);
      if (ptrPattern) {
        const dx = x - ptrPattern[0], dy = y - ptrPattern[1], d = Math.hypot(dx, dy);
        if (d < .6 && d > 1e-4) { const f = .05 * (1 - d / .6); x += dx / d * f; if (KIND[k] === 'j') y += dy / d * f; }
      }
      out[k] = [clamp(x, .06, .94), clamp(y, 0, 1)];
    }
    return out;
  };
  const toWorld = ([x, y]) => { if (L.portrait) [x, y] = [y, x]; return [L.px + x * L.pw, L.pTop - y * L.ph]; };
  const buildCells = (t, fixPivot) => {
    const pts = patternPoints(t);
    const rect = { x: L.px, y: L.pTop, w: L.pw, h: L.ph };
    CELLS.forEach((names, i) => {
      const poly = insetPoly(names.map(n => toWorld(pts[n])), L.gap * S * .5);
      if (fixPivot) cells[i].pivotFixed = centroid(poly);
      setGeo(cells[i], poly, rect);
    });
  };

  /* ---------------- 3D portrait: photo + hand-modelled depth ---------------- */
  const texLoader = new THREE.TextureLoader();
  const loadTex = url => new Promise(res => texLoader.load(url, res, undefined, () => res(null)));
  const [meTex, meDepth] = await Promise.all([loadTex('img/me.webp'), loadTex('img/me-depth.webp')]);
  const me = { on: !!(meTex && meDepth), g: new THREE.Group(), show: 0, cx: 0, headY: 0, Hp: 1 };
  const meU = {
    uMap: { value: meTex }, uDepth: { value: meDepth }, uAmp: { value: 100 }, uSize: { value: new THREE.Vector2(1, 1) },
    uTexel: { value: 1 / 512 }, uKey: { value: new THREE.Vector3(-.55, .65, .6).normalize() },
    uRim: { value: new THREE.Vector3(.7, .2, .5).normalize() }, uFade: { value: 0 },
  };
  let meMesh = null, halo = null;
  if (me.on) {
    meTex.colorSpace = THREE.SRGBColorSpace;
    meTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const meMat = new THREE.ShaderMaterial({
      uniforms: meU, transparent: true, depthWrite: true,
      vertexShader: `uniform sampler2D uDepth;uniform float uAmp;uniform vec2 uSize;uniform float uTexel;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;
float D(vec2 u){return texture2D(uDepth,u).r;}
void main(){
  vUv=uv;
  vec3 p=position;p.z+=D(uv)*uAmp;
  float dx=(D(uv+vec2(uTexel,0.))-D(uv-vec2(uTexel,0.)))*uAmp/(2.*uTexel*uSize.x);
  float dy=(D(uv+vec2(0.,uTexel))-D(uv-vec2(0.,uTexel)))*uAmp/(2.*uTexel*uSize.y);
  vN=normalize(normalMatrix*normalize(vec3(-dx,-dy,1.)));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vV=-mv.xyz;
  gl_Position=projectionMatrix*mv;
}`,
      fragmentShader: `uniform sampler2D uMap;uniform vec3 uKey;uniform vec3 uRim;uniform float uFade;
varying vec2 vUv;varying vec3 vN;varying vec3 vV;
void main(){
  vec4 c=texture2D(uMap,vUv,-.6);
  float a=c.a*smoothstep(0.,.14,vUv.y)*uFade;
  if(a<.1)discard;
  vec3 n=normalize(vN),v=normalize(vV),k=normalize(uKey);
  vec3 col=c.rgb*(.9+.16*max(dot(n,k),0.));
  float fr=pow(1.-max(dot(n,v),0.),2.6);
  col+=vec3(.6,.54,.92)*fr*.16*smoothstep(-.1,.8,dot(n,normalize(uRim)))*smoothstep(.6,1.,c.a);
  col+=vec3(1.,.96,.9)*pow(max(dot(reflect(-k,n),v),0.),30.)*.1;
  gl_FragColor=vec4(col,a);
  #include <colorspace_fragment>
}`,
    });
    meMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 220, 220), meMat);
    meMesh.renderOrder = 3;
    const haloMat = glassMat(true, 1); haloMat.envMapIntensity = 2.4; haloMat.roughness = .18;
    halo = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 24, 180), haloMat);
    me.g.add(halo, meMesh);
    block.add(me.g);
  }
  const buildMe = () => {
    if (!me.on) return;
    const phone = L.portrait;
    const Hp = phone ? L.ph * .42 : L.ph * .97;
    const cx = L.px + L.pw * (phone ? .72 : .725);
    const bottom = L.pTop - L.ph;
    me.Hp = Hp; me.cx = cx; me.headY = bottom + Hp * .62;
    meMesh.geometry.dispose();
    meMesh.geometry = new THREE.PlaneGeometry(Hp, Hp, 220, 220);
    meMesh.position.set(0, Hp / 2 - Hp * .62, 0);
    meU.uAmp.value = Hp * .11; meU.uSize.value.set(Hp, Hp);
    const r = Hp * .235;
    halo.geometry.dispose();
    halo.geometry = new THREE.TorusGeometry(r, Math.max(4, 10 * S), 32, 220);
    halo.position.set(Hp * .015, Hp * (.715 - .62), -60 * S);
  };

  /* ---------------- light-mode backdrop + slab shadow ---------------- */
  const blobTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640;
    const x = cv.getContext('2d');
    x.fillStyle = '#e2dfd8'; x.fillRect(0, 0, 1024, 640);
    const blob = (fx, fy, r, c) => { const g = x.createRadialGradient(fx * 1024, fy * 640, 0, fx * 1024, fy * 640, r * 1024); g.addColorStop(0, c); g.addColorStop(1, 'rgba(226,223,216,0)'); x.fillStyle = g; x.fillRect(0, 0, 1024, 640); };
    blob(.74, .34, .42, 'rgba(206,168,98,.75)');
    blob(.22, .72, .38, 'rgba(146,122,255,.5)');
    blob(.93, .86, .3, 'rgba(96,160,255,.5)');
    blob(.4, .1, .3, 'rgba(255,160,128,.42)');
    blob(.55, .62, .22, 'rgba(120,214,180,.35)');
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const shadowTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const x = cv.getContext('2d'); x.filter = 'blur(26px)'; x.fillStyle = 'rgba(0,0,0,.6)';
    x.beginPath(); x.roundRect(70, 70, 372, 372, 40); x.fill();
    return new THREE.CanvasTexture(cv);
  })();
  fxBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, toneMapped: false }));
  fxBack.renderOrder = -2; scene.add(fxBack);
  fxShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false, color: 0x2a2620 }));
  fxShadow.renderOrder = -1; block.add(fxShadow);
  const buildFx = () => {
    const back = 520, f = (camera.position.z + back) / camera.position.z;
    fxBack.position.set(0, 0, -back); fxBack.scale.set(W * f * 1.2, H * f * 1.2, 1);
    fxShadow.position.set(L.left + L.bw / 2 + 14 * S, L.top - L.bh / 2 - 30 * S, -L.bev * 3 - 6);
    fxShadow.scale.set(L.bw * 1.22, L.bh * 1.3, 1);
  };

  /* ---------------- back sliver ---------------- */
  const sliverMat = glassMat(false, .35);
  const sliver = new THREE.Mesh(new THREE.BufferGeometry(), sliverMat);
  const sliverG = new THREE.Group(); sliverG.add(sliver); scene.add(sliverG); sliverG.visible = false;
  let sliverS = 0, sliverHover = 0;
  const buildSliver = () => {
    const k = W / 1918;
    const fr = [[.147, .243], [.252, .169], [.287, .277], [.151, .258]];
    let poly = fr.map(([fx, fy]) => [(fx - .5) * W, (.5 - fy) * H]);
    if (W < 700) poly = [[-.36, .36], [.3, .41], [.36, .3], [-.34, .3]].map(([fx, fy]) => [fx * W, fy * H]);
    const c = centroid(poly);
    sliverG.position.set(c[0], c[1], 0);
    sliver.geometry.dispose();
    sliver.geometry = extrude(roundedShape(poly, 8 * k, c[0], c[1]), 11 * k, 3 * k);
  };

  /* ---------------- shatter choreography ---------------- */
  let state = 'intro', stateT = 0;
  const seedFly = () => {
    pieces.forEach((p, i) => {
      const cx = p.pivot[0], cy = p.pivot[1] - (L.top - L.bh / 2);
      const l = Math.hypot(cx, cy) || 1;
      p.fly.v = [cx / l * rnd(260, 560) * S, cy / l * rnd(160, 420) * S - 240 * S, rnd(420, 800) * S];
      p.fly.axis.set(rnd(-1, 1), rnd(-1, 1), rnd(-.4, .4)).normalize();
      p.fly.ang = rnd(2, 3.6) * (Math.random() < .5 ? -1 : 1);
      p.fly.delay = p.isNav ? 0 : .03 + i * .03;
    });
  };
  const G = () => -1500 * S;
  const flyOffset = (p, u) => {
    const T = u * 1.05;
    return [p.fly.v[0] * T, p.fly.v[1] * T + .5 * G() * T * T, p.fly.v[2] * T];
  };
  const shatter = () => {
    if (state !== 'rest') return;
    seedFly(); state = 'out'; stateT = 0;
    hero.classList.add('gh-shattered');
    elTerms.classList.remove('hide-fast'); elTerms.classList.add('show'); elTerms.setAttribute('aria-hidden', 'false');
    elBack.classList.add('show'); elBack.tabIndex = 0;
    sliverG.visible = true;
  };
  const reassemble = () => {
    if (state !== 'terms' && state !== 'out') return;
    state = 'back'; stateT = 0;
    elTerms.classList.add('hide-fast'); elTerms.classList.remove('show'); elTerms.setAttribute('aria-hidden', 'true');
    elBack.classList.remove('show'); elBack.tabIndex = -1;
  };
  elRead.addEventListener('click', shatter);
  elBack.addEventListener('click', reassemble);
  addEventListener('keydown', e => { if (e.key === 'Escape' && (state === 'terms' || state === 'out')) reassemble(); });
  elBack.addEventListener('pointerenter', () => { sliverHover = 1; });
  elBack.addEventListener('pointerleave', () => { sliverHover = 0; });

  /* ---------------- pointer ---------------- */
  let ptrIn = false, nx = 0, ny = 0, tiltX = 0, tiltY = 0, glow = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), local = new THREE.Vector3();
  // mouse hovers; on touch, the finger acts as the pointer and lingers briefly after lifting
  let touchTimer = 0;
  const aim = e => {
    const r = hero.getBoundingClientRect();
    nx = (e.clientX - r.left) / r.width * 2 - 1; ny = -((e.clientY - r.top) / r.height * 2 - 1);
    ptrIn = true;
    if (e.pointerType === 'touch') clearTimeout(touchTimer);
  };
  hero.addEventListener('pointermove', aim, { passive: true });
  hero.addEventListener('pointerdown', aim, { passive: true });
  const lift = e => { if (e.pointerType === 'touch') { clearTimeout(touchTimer); touchTimer = setTimeout(() => { ptrIn = false; }, 1100); } };
  hero.addEventListener('pointerup', lift); hero.addEventListener('pointercancel', lift);
  hero.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') ptrIn = false; });
  document.addEventListener('mouseleave', () => { ptrIn = false; });

  /* ---------------- homography for the text layer ---------------- */
  const proj = new THREE.Vector3();
  const toScreen = (x, y, z) => { proj.set(x, y, z).applyMatrix4(block.matrixWorld).project(camera); return [(proj.x + 1) / 2 * W, (1 - proj.y) / 2 * H]; };
  const homography = (w, h, p) => {
    const [x0, y0] = p[0], [x1, y1] = p[1], [x2, y2] = p[2], [x3, y3] = p[3];
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
    return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
  };
  const mapLayer = (el, x0, y0, w, h) => {
    const z = L.printZ;
    el.style.transform = homography(w, h, [toScreen(x0, y0, z), toScreen(x0 + w, y0, z), toScreen(x0 + w, y0 - h, z), toScreen(x0, y0 - h, z)]);
  };

  /* ---------------- loop ---------------- */
  hero.classList.add('gh-on');
  layout();
  applyTheme();
  seedFly();
  let visible = true, last = performance.now(), lastBuild = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 100); });
  document.fonts && document.fonts.ready.then(() => repaint());
  setInterval(repaint, 30000);   // keeps the printed Lagos clock current
  document.addEventListener('ojtheme', () => requestAnimationFrame(repaint));

  const spring = (p, key, vkey, target, k, c, dt) => { const a = k * (target - p[key]) - c * p[vkey]; p[vkey] += a * dt; p[key] += p[vkey] * dt; };
  const qT = new THREE.Quaternion(), qE = new THREE.Quaternion(), eul = new THREE.Euler();

  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    // scroll: scatter when leaving the hero, reassemble on the way back
    const sc = window.__lenis ? window.__lenis.scroll : window.scrollY;
    if (sc > H * .3 && state !== 'leave' && state !== 'away') {
      if (state === 'rest') seedFly();
      const wasOut = state === 'terms' || state === 'out';
      elTerms.classList.add('hide-fast'); elTerms.classList.remove('show'); elTerms.setAttribute('aria-hidden', 'true');
      elBack.classList.remove('show'); elBack.tabIndex = -1;
      hero.classList.add('gh-shattered');
      state = wasOut ? 'away' : 'leave'; stateT = 0;
    } else if (sc < H * .2 && (state === 'leave' || state === 'away')) {
      state = 'back'; stateT = 0;
    }
    if (!visible) return;
    const t = now / 1000;
    stateT += dt;

    // global tilt, as if pressed at the pointer
    const kT = 1 - Math.exp(-dt / .3);
    tiltX += ((ptrIn ? nx : 0) - tiltX) * kT; tiltY += ((ptrIn ? ny : 0) - tiltY) * kT;
    block.rotation.y = THREE.MathUtils.degToRad(tiltX * 7 - 1.2);
    block.rotation.x = THREE.MathUtils.degToRad(-tiltY * 5.5 + .8);
    block.updateMatrixWorld();

    // pointer → block plane
    let hovP = null, ptrLocal = null;
    if (ptrIn) {
      ndc.set(nx, ny); ray.setFromCamera(ndc, camera);
      plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(block.quaternion), block.localToWorld(new THREE.Vector3(0, 0, L.printZ)));
      if (ray.ray.intersectPlane(plane, hit)) {
        glowU.uPtr.value.copy(hit);
        ptrLocal = block.worldToLocal(local.copy(hit));
        const px = (ptrLocal.x - L.px) / L.pw, py = (L.pTop - ptrLocal.y) / L.ph;
        ptrPattern = (px > -.2 && px < 1.2 && py > -.2 && py < 1.2) ? (L.portrait ? [py, px] : [px, py]) : null;
      }
      if (state === 'rest') {
        const hits = ray.intersectObjects(pieces.map(p => p.glass), false);
        if (hits.length) hovP = hits[0].object.userData.piece;
      }
    } else ptrPattern = null;
    glow += ((ptrIn && state === 'rest' ? 1 : 0) - glow) * (1 - Math.exp(-dt / .25));
    glowU.uGlow.value = glow;

    // breathe the cut lines (~45 rebuilds/s)
    if ((state === 'rest' || state === 'intro') && now - lastBuild > (lite ? 140 : 33)) { buildCells(t, false); lastBuild = now; }

    // per-piece hover springs + flight
    const flying = state === 'out' || state === 'back' || state === 'intro' || state === 'terms' || state === 'leave' || state === 'away';
    pieces.forEach(p => {
      const isHov = p === hovP;
      let tz = 0, trx = 0, tryy = 0;
      if (isHov && ptrLocal) {
        tz = (p.isNav ? 32 : 50) * S;
        const vx = clamp((ptrLocal.x - p.pivot[0]) / Math.max(p.half[0], 1), -1, 1);
        const vy = clamp((ptrLocal.y - p.pivot[1]) / Math.max(p.half[1], 1), -1, 1);
        tryy = vx * .24 * (p.isNav ? .35 : 1); trx = -vy * .24 * (p.isNav ? .5 : 1);
      }
      const steps = 2, h = dt / steps;
      for (let s = 0; s < steps; s++) {
        spring(p, 'z', 'vz', tz, 170, 19, h); spring(p, 'rx', 'vrx', trx, 170, 19, h); spring(p, 'ry', 'vry', tryy, 170, 19, h);
        spring(p, 'h', 'vh', isHov ? 1 : 0, 170, 19, h);
      }
      p.mat.iridescence = .55 + .45 * clamp(p.h, 0, 1);
      p.mat.envMapIntensity = 1 + .9 * clamp(p.h, 0, 1);

      let u = 0;
      if (flying) {
        const tau = clamp((stateT - p.fly.delay) / .72, 0, 1);
        if (state === 'out') u = easeIn(tau);
        else if (state === 'leave') u = tau * tau * (1.6 - .6 * tau);
        else if (state === 'terms' || state === 'away') u = 1;
        else u = 1 - easeOutBack(tau);           // back + intro
      }
      const off = u > 0 ? flyOffset(p, u) : [0, 0, 0];
      p.g.position.set(p.pivot[0] + off[0], p.pivot[1] + off[1], p.z + off[2]);
      eul.set(p.rx, p.ry, 0); qE.setFromEuler(eul);
      qT.setFromAxisAngle(p.fly.axis, p.fly.ang * u);
      p.g.quaternion.copy(qT).multiply(qE);
      p.g.visible = u < .995;
    });

    if (state === 'out' && stateT > .72 + .03 * 6) state = 'terms';
    if (state === 'leave' && stateT > .72 + .03 * 6) state = 'away';
    if ((state === 'back' || state === 'intro') && stateT > .72 + .03 * 6 + .05) {
      state = 'rest'; hero.classList.remove('gh-shattered');
      if (sliverS < .01) sliverG.visible = false;
    }

    // back sliver: grows in after .3s, wobbles, tips toward pointer
    const wantS = (state === 'out' && stateT > .3) || state === 'terms' ? 1 : 0;
    sliverS += (wantS - sliverS) * (1 - Math.exp(-dt / (wantS ? .16 : .1)));
    if (sliverG.visible) {
      const s = Math.max(.0001, sliverS);
      sliverG.scale.setScalar(s);
      let hx = 0, hy = 0;
      if (ptrIn && sliverHover) { hy = nx * .14; hx = -ny * .14; }
      sliverG.rotation.set(.08 + Math.sin(t * 6.2) * .03 + hx, -.16 + Math.sin(t * 5.4 + 1) * .04 + hy, 0);
      sliverMat.iridescence = .35 + .4 * sliverHover;
      if (sliverS < .002 && wantS === 0 && (state === 'rest' || state === 'back')) sliverG.visible = false;
    }

    // portrait: turns with the cursor, breathes, steps back when the page shatters
    if (me.on) {
      const wantMe = (state === 'rest' || (state === 'intro' && stateT > .35) || (state === 'back' && stateT > .3)) ? 1 : 0;
      me.show += (wantMe - me.show) * (1 - Math.exp(-dt / (wantMe ? .35 : .12)));
      meU.uFade.value = me.show;
      me.g.position.set(me.cx, me.headY, 90 * S - (1 - me.show) * 260 * S);
      me.g.rotation.set(-tiltY * .1 + Math.sin(t * .7) * .012, tiltX * .24 + Math.sin(t * .45) * .03, 0);
      me.g.scale.set(1, 1 + Math.sin(t * 1.5) * .004, 1);
      meU.uRim.value.set(ptrIn ? nx : .7, ptrIn ? ny : .2, .55).normalize();
      halo.rotation.set(Math.sin(t * .6) * .12 + tiltY * .2, Math.cos(t * .5) * .16 - tiltX * .25, t * .1);
      halo.visible = me.show > .02;
      me.g.visible = me.show > .005;
    }

    // text layer follows the panel plane
    if (state === 'rest' || state === 'intro') {
      mapLayer(elNav, L.left, L.top, L.bw, L.navH);
      mapLayer(elPanel, L.px, L.pTop, L.pw, L.ph);
    }

    if (fxBack && lightT > .01) { fxBack.position.x = Math.sin(t * .11) * 40 * S; fxBack.position.y = Math.cos(t * .09) * 30 * S; }
    if (fxShadow) {
      const settled = state === 'rest' || ((state === 'intro' || state === 'back') && stateT > .55) ? 1 : 0;
      fxShadowOp += (settled - fxShadowOp) * (1 - Math.exp(-dt / .2));
      fxShadow.material.opacity = .55 * lightT * fxShadowOp;
      fxShadow.visible = fxShadow.material.opacity > .005;
    }
    const lt = isLight() ? 1 : 0;
    if (Math.abs(lt - lightT) > .001) { lightT += (lt - lightT) * (1 - Math.exp(-dt / .18)); if (Math.abs(lt - lightT) < .002) lightT = lt; applyTheme(); }
    renderer.render(scene, camera);
    // adaptive quality: if frames run slow, render fewer pixels
    // slow device? first drop the costly extras, only then trim resolution (never below dprFloor)
    if (perfN < 180 && dt > 0 && dt < .1) {
      perfN++; perfAcc += dt;
      if (perfN === 60) { if (perfAcc / 60 > .022) lite = true; perfAcc = 0; }
      if (perfN === 180 && perfAcc / 120 > .024 && dprCap > dprFloor) { dprCap = Math.max(dprFloor, dprCap * .75); renderer.setPixelRatio(dprCap); layout(); }
    }
  };
  let perfN = 0, perfAcc = 0, lite = false;
  hero.classList.add('gh-shattered');      // fly in on load
  state = 'intro'; stateT = 0;
  requestAnimationFrame(frame);
}
