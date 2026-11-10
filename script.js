/* ==========================================================
   Onyekachi Jeremiah — portfolio runtime
   Vanilla JS. One rAF loop. Lenis for smooth scroll.
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktopWork = matchMedia('(min-width: 901px)');

  let vw = innerWidth, vh = innerHeight;
  let scrollY = window.scrollY;

  /* ---------- text splitting ---------- */
  $$('.split').forEach(el => {
    const txt = el.textContent;
    el.textContent = '';
    [...txt].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      s.textContent = c;
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    });
  });
  $$('.reveal-words').forEach(el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => $('.hero').classList.add('is-in')));

  /* ---------- reveal on view ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: .15, rootMargin: '0px 0px -5% 0px' });
  $$('.reveal, .reveal-words').forEach(el => io.observe(el));

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  const startLenis = () => {
    if (reduced || !window.Lenis || lenis) return;
    lenis = new window.Lenis({ lerp: .09, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', e => { scrollY = e.scroll; });
    window.__lenis = lenis;
  };
  if (window.Lenis) startLenis(); else { const lt = setInterval(() => { if (window.Lenis) { clearInterval(lt); startLenis(); } }, 40); setTimeout(() => clearInterval(lt), 8000); }

  const scrollToEl = target => {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4, easing: t => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const t = id === '#top' ? document.body : $(id);
    if (!t) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(t);
    if (id !== '#top') history.replaceState(null, '', id);
  });

  /* ---------- nav ---------- */
  const nav = $('#nav');
  let lastY = 0;
  const navLinks = $$('.nav-links a');
  const sections = navLinks.map(a => $(a.getAttribute('href')));
  const updateNav = () => {
    nav.classList.toggle('solid', scrollY > 40);
    nav.classList.toggle('over-hero', scrollY < vh * .72 && !menuOpen);
    const down = scrollY > lastY && scrollY > vh * .8;
    if (!menuOpen) nav.classList.toggle('hide', down && Math.abs(scrollY - lastY) > 2);
    if (scrollY < lastY - 2) nav.classList.remove('hide');
    lastY = scrollY;
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.offsetTop - vh * .4 <= scrollY) cur = i; });
    navLinks.forEach((a, i) => a.classList.toggle('on', i === cur));
  };

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn'), mob = $('#mobMenu');
  let menuOpen = false;
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    mob.classList.remove('open'); mob.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
  }
  menuBtn.addEventListener('click', () => {
    if (menuOpen) return closeMenu();
    menuOpen = true;
    mob.classList.add('open'); mob.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    nav.classList.remove('hide');
    lenis && lenis.stop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Lagos clock ---------- */
  const clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  const tick = () => { const t = clockFmt.format(new Date()); $$('[data-clock]').forEach(c => c.textContent = t); };
  tick(); setInterval(tick, 20000);

  /* ==========================================================
     HERO — raymarched liquid glass (raw WebGL, ~3KB)
     ========================================================== */
  const hero = { on: false, gl: null };
  (() => {
    const canvas = $('#gl');
    const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return;

    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;
uniform vec2 R;uniform float T;uniform vec2 M;uniform float S;uniform vec2 O;uniform float Q;uniform float Z;
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float map(vec3 p){
  p.xy-=O; p.y+=S*1.4;
  p.xz*=rot(M.x*.6+T*.07); p.yz*=rot(-M.y*.4);
  float t=T*.45;
  float d=length(p-vec3(sin(t*1.1)*.42,cos(t*.8)*.28,sin(t*.6)*.2))-.6;
  d=smin(d,length(p-vec3(cos(t*.9+1.)*.68,sin(t*1.3)*.42,cos(t*.7)*.3))-.42,.5);
  d=smin(d,length(p-vec3(sin(t*.7+2.)*.52,sin(t*1.1+1.)*.55,.25))-.34,.5);
  d=smin(d,length(p-vec3(cos(t*.5+4.)*.6,cos(t*.9+3.)*.5,-.2))-.28,.45);
  d+=.022*sin(p.x*5.+T)*sin(p.y*5.+T*1.2)*sin(p.z*5.+T*.8);
  return d;
}
vec3 nrm(vec3 p){vec2 e=vec2(.003,0.);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
/* backdrop the glass refracts: paper, hairline grid, warm light */
vec3 bgf(vec2 fc){
  vec2 c=fc/Q;
  vec2 m=mod(c,88.);
  float dd=min(min(m.x,88.-m.x),min(m.y,88.-m.y));
  float line=1.-smoothstep(0.,1.1,dd);
  vec2 uv=(fc-.5*R)/R.y;
  float mask=1.-smoothstep(.25,1.,length(uv*vec2(.55,1.)));
  vec3 col=vec3(.953,.945,.925);
  vec2 bp=uv-O*1.75/Z-vec2(0.,S*.6);
  col=mix(col,vec3(1.),exp(-dot(bp,bp)*3.)*.28);
  vec2 gp=bp+vec2(.18,.3);
  col=mix(col,vec3(.88,.80,.64),exp(-dot(gp,gp)*5.)*.28);
  col-=line*.055*mask;
  return col;
}
void main(){
  vec2 fc=gl_FragCoord.xy;
  vec2 uv=(fc-.5*R)/R.y;
  vec3 col;
  vec3 ro=vec3(0.,0.,Z),rd=normalize(vec3(uv,-1.75));
  float t=0.,d=1.,md=9.;bool hit=false;
  for(int i=0;i<72;i++){d=map(ro+rd*t);md=min(md,d);if(d<.0015){hit=true;break;}t+=d*.9;if(t>Z+3.)break;}
  if(hit){
    vec3 p=ro+rd*t,n=nrm(p);
    float ndv=max(dot(-rd,n),0.);
    float f=pow(1.-ndv,3.);
    /* refraction with chromatic dispersion — stronger toward the rim */
    vec2 off=n.xy*R.y*(.06+.16*f);
    vec3 g=vec3(bgf(fc-off*1.1).r,bgf(fc-off).g,bgf(fc-off*.9).b);
    g*=vec3(.975,.98,.995);
    vec3 r=reflect(rd,n);
    float env=smoothstep(-.3,.9,r.y);
    col=mix(g,vec3(1.),f*(.12+.38*env));
    col*=1.-smoothstep(.55,1.,f)*.16;
    /* faint thin-film tint on the very edge */
    vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+f*1.6+n.y*.25+T*.02));
    col=mix(col,col*(.75+.5*irid),smoothstep(.45,1.,f)*.22);
    /* inner caustic: light gathered on the side away from the light */
    vec3 l=normalize(vec3(.45,.85,.6));
    col+=vec3(1.,.97,.9)*pow(max(dot(n,-l),0.),3.)*.08;
    /* speculars: key + soft fill */
    col+=pow(max(dot(r,l),0.),110.)*1.5;
    col+=pow(max(dot(r,normalize(vec3(-.7,.2,.7))),0.),24.)*.18;
    col=mix(col,vec3(.55,.5,.44),smoothstep(.93,1.,f)*.25);
  }else{
    col=bgf(fc);
    col*=1.-exp(-md*7.)*.05;
  }
  float gr=fract(sin(dot(fc,vec2(12.9898,78.233))+T*7.)*43758.5453);
  col+=(gr-.5)*.018;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn(gl.getShaderInfoLog(s)), null); };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const uR = U('R'), uT = U('T'), uM = U('M'), uS = U('S'), uO = U('O'), uQ = U('Q'), uZ = U('Z');

    // adaptive resolution: start modest, settle where frames stay under ~18ms
    let q = Math.min(devicePixelRatio || 1, 2) * (vw < 700 ? .5 : .62);
    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth * q));
      const h = Math.max(2, Math.round(canvas.clientHeight * q));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uQ, w / canvas.clientWidth);
      const asp = w / h;
      // glass sits right of the headline on wide screens, above it on phones
      if (asp > 1.15) { gl.uniform1f(uZ, 4.9); gl.uniform2f(uO, Math.min(1.35, asp * .64), .05); }
      else { gl.uniform1f(uZ, 5.2); gl.uniform2f(uO, asp < .8 ? .35 : .5, asp < .8 ? .95 : .7); }
    };
    resize();

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer) addEventListener('pointermove', e => { mouse.tx = e.clientX / vw * 2 - 1; mouse.ty = -(e.clientY / vh * 2 - 1); }, { passive: true });

    let frames = 0, acc = 0, settled = 0, t0 = performance.now(), last = t0;
    hero.gl = { resize };
    hero.render = (now) => {
      const dt = now - last; last = now;
      mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
      gl.uniform1f(uT, (now - t0) / 1000);
      gl.uniform2f(uM, mouse.x, mouse.y);
      gl.uniform1f(uS, clamp(scrollY / vh, 0, 1.2));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (settled < 4 && dt < 100) {
        acc += dt; frames++;
        if (frames === 40) {
          const avg = acc / frames;
          if (avg > 19 && q > .3) { q *= .78; resize(); }
          else if (avg < 12 && q < Math.min(devicePixelRatio, 2) * .9) { q *= 1.12; resize(); }
          else settled = 4;
          settled++; frames = 0; acc = 0;
        }
      }
    };
    hero.render(performance.now());
    canvas.classList.add('ready');
    hero.on = !reduced;
    new IntersectionObserver(([e]) => { hero.on = e.isIntersecting && !reduced; }, { threshold: 0 }).observe($('.hero'));
    document.addEventListener('visibilitychange', () => { hero.on = !document.hidden && !reduced && scrollY < vh * 1.2; });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); hero.on = false; canvas.classList.remove('ready'); });
  })();

  /* ==========================================================
     WORK — pinned horizontal track with 3D depth
     ========================================================== */
  const work = $('#work'), pin = $('.work-pin'), track = $('#track');
  const tiles = $$('.tile', track);
  const nowEl = $('#workNow'), bar = $('#workBar');
  $('#workTotal').textContent = String(tiles.filter(t => t.dataset.n).length).padStart(2, '0');
  let wTop = 0, wDist = 0, tileX = [], tileW = 0, trackPad = 0, lastIdx = -1;

  const measureWork = () => {
    if (work.classList.contains('is-3d')) return;
    if (!desktopWork.matches) { work.style.height = ''; track.style.transform = ''; tiles.forEach(t => t.style.transform = ''); return; }
    track.style.transform = 'none';
    const trackW = track.scrollWidth;
    wDist = Math.max(0, trackW - vw);
    work.style.height = (vh + wDist) + 'px';
    wTop = work.getBoundingClientRect().top + scrollY;
    tileX = tiles.map(t => t.offsetLeft + t.offsetWidth / 2);
    tileW = tiles[0].offsetWidth;
    trackPad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
  };

  const updateWork = () => {
    if (work.classList.contains('is-3d')) return;
    if (!desktopWork.matches) return;
    const p = wDist ? clamp((scrollY - wTop) / wDist, 0, 1) : 0;
    const x = -p * wDist;
    track.style.transform = `translate3d(${x}px,0,0)`;
    bar.style.transform = `scaleX(${p})`;
    let best = 0, bestD = 1e9;
    const half = vw / 2;
    const active = scrollY > wTop - vh && scrollY < wTop + wDist + vh;
    tiles.forEach((t, i) => {
      const c = tileX[i] + x;
      const d = clamp((c - half) / (half + tileW * .3), -1.4, 1.4);
      const ad = Math.abs(d);
      if (ad < bestD) { bestD = ad; best = i; }
      t.style.transform = `perspective(1400px) translate3d(0,${(ad * ad * 26).toFixed(1)}px,${(-ad * 180).toFixed(1)}px) rotateY(${(-d * 24).toFixed(2)}deg)`;
      t.style.opacity = (1 - Math.max(0, ad - 1) * 1.6).toFixed(3);
      t.style.zIndex = 100 - Math.round(ad * 50);
      if (t._vid) toggleVideo(t, active && ad < .5);
    });
    if (best !== lastIdx) { lastIdx = best; nowEl.textContent = String(Math.min(best + 1, tiles.length - 1)).padStart(2, '0'); }
  };

  /* video: load + play only when the tile is the focus */
  tiles.forEach(t => { const v = $('video', t); if (v) t._vid = v; });
  function toggleVideo(t, play) {
    const v = t._vid;
    if (play) {
      if (!v.src) { v.src = v.dataset.src; v.addEventListener('playing', () => v.classList.add('on'), { once: true }); }
      if (v.paused) v.play().catch(() => {});
    } else if (!v.paused) v.pause();
  }
  const vio = new IntersectionObserver(es => es.forEach(e => {
    if (desktopWork.matches || work.classList.contains('is-3d')) return;
    toggleVideo(e.target, e.isIntersecting);
  }), { threshold: .55 });
  tiles.forEach(t => t._vid && vio.observe(t));

  /* ---------- pointer tilt + glare ---------- */
  if (finePointer && !reduced) {
    const bindTilt = (el, inner, max) => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        inner.style.setProperty('--ry', ((px - .5) * max).toFixed(2) + 'deg');
        inner.style.setProperty('--rx', ((.5 - py) * max).toFixed(2) + 'deg');
        inner.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => { inner.style.setProperty('--rx', '0deg'); inner.style.setProperty('--ry', '0deg'); });
    };
    $$('.tile').forEach(t => bindTilt(t, $('.tile-in', t), 10));
    $$('.card').forEach(c => bindTilt(c, $('.card-in', c), 16));

    /* magnetic buttons */
    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .25).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .35).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
  }

  /* ---------- main loop ---------- */
  let lastScroll = -1;
  const loop = now => {
    if (lenis) lenis.raf(now); else scrollY = window.scrollY;
    if (scrollY !== lastScroll) { updateNav(); updateWork(); lastScroll = scrollY; }
    if (hero.on && hero.render) hero.render(now);
    requestAnimationFrame(loop);
  };

  const onResize = () => {
    vw = innerWidth; vh = innerHeight;
    measureWork(); hero.gl && hero.gl.resize();
    lastScroll = -1;
  };
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(onResize, 120); });
  desktopWork.addEventListener('change', onResize);
  addEventListener('load', onResize);
  if (document.fonts) document.fonts.ready.then(onResize);
  measureWork();
  requestAnimationFrame(loop);

  /* ==========================================================
     TOASTS (no native alerts, ever)
     ========================================================== */
  const toasts = $('#toasts');
  const toast = (msg, type = 'ok', ms = 4200) => {
    const el = document.createElement('div');
    el.className = 'toast lg' + (type === 'err' ? ' err' : '');
    el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.innerHTML = `<b>${type === 'err' ? '!' : '✓'}</b><span></span>`;
    el.lastChild.textContent = msg;
    toasts.appendChild(el);
    setTimeout(() => { el.classList.add('out'); el.addEventListener('animationend', () => el.remove(), { once: true }); }, ms);
  };

  /* ==========================================================
     CUSTOM SELECT
     ========================================================== */
  const sel = $('#projSelect');
  const selBtn = $('.select-btn', sel), selList = $('.select-list', sel);
  const opts = $$('li', selList), hidden = $('#project'), selVal = $('#projValue');
  let act = -1;
  const setAct = i => { act = (i + opts.length) % opts.length; opts.forEach((o, j) => o.classList.toggle('act', j === act)); opts[act].scrollIntoView({ block: 'nearest' }); };
  const openSel = () => { sel.classList.add('open'); selBtn.setAttribute('aria-expanded', 'true'); const s = opts.findIndex(o => o.getAttribute('aria-selected') === 'true'); setAct(s < 0 ? 0 : s); };
  const closeSel = () => { sel.classList.remove('open'); selBtn.setAttribute('aria-expanded', 'false'); };
  const choose = i => {
    opts.forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
    hidden.value = opts[i].textContent; selVal.textContent = opts[i].textContent;
    sel.classList.add('has'); sel.closest('.field').classList.remove('bad');
    closeSel(); selBtn.focus();
  };
  selBtn.addEventListener('click', () => sel.classList.contains('open') ? closeSel() : openSel());
  opts.forEach((o, i) => { o.addEventListener('click', () => choose(i)); o.addEventListener('pointerenter', () => setAct(i)); });
  selBtn.addEventListener('keydown', e => {
    const open = sel.classList.contains('open');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) openSel(); else setAct(act + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(act); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); closeSel(); }
    else if (e.key === 'Tab' && open) closeSel();
  });
  document.addEventListener('pointerdown', e => { if (!sel.contains(e.target)) closeSel(); });
  selList.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  selList.setAttribute('data-lenis-prevent', '');

  /* ==========================================================
     CONTACT FORM → Google Forms
     ========================================================== */
  const FORM_ID = '1FAIpQLSczV7to0hvM6wCbxzx_qfncLimfOWYEuap8438x4IngDO4f0w';
  const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/formResponse`;
  const FIELD_MAP = { name: '780854094', email: '383541647', project: '714113470', message: '511356580' };
  const form = $('#contactForm');
  const sendBtn = $('.send', form);

  form.addEventListener('input', e => e.target.closest('.field')?.classList.remove('bad'));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    const bad = [];
    if (!String(data.get('name')).trim()) bad.push('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get('email')).trim())) bad.push('email');
    if (!String(data.get('project')).trim()) bad.push('project');
    if (!String(data.get('message')).trim()) bad.push('message');
    if (bad.length) {
      bad.forEach(n => { const f = $('#' + n, form).closest('.field'); f.classList.remove('bad'); void f.offsetWidth; f.classList.add('bad'); });
      toast(bad.includes('email') && bad.length === 1 ? 'That email address doesn’t look right.' : 'Please fill in the highlighted fields.', 'err');
      return;
    }
    const body = new URLSearchParams();
    for (const [k, v] of data.entries()) if (FIELD_MAP[k]) body.append(`entry.${FIELD_MAP[k]}`, v);

    sendBtn.classList.add('busy');
    $('span', sendBtn).textContent = 'Sending';
    $('i', sendBtn).textContent = '◌';
    try {
      await fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body });
      form.reset(); hidden.value = ''; selVal.textContent = ''; sel.classList.remove('has');
      opts.forEach(o => o.setAttribute('aria-selected', 'false'));
      toast('Message sent. I’ll get back to you within a day.');
    } catch {
      toast('Couldn’t send right now. Try WhatsApp or email instead.', 'err', 6000);
    } finally {
      sendBtn.classList.remove('busy');
      $('span', sendBtn).textContent = 'Send message';
      $('i', sendBtn).textContent = '→';
    }
  });

  /* ==========================================================
     LIQUID GLASS — pointer-lit specular rim, gloss, jelly, press
     ========================================================== */
  (() => {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    if (brands.some(b => /Chromium/.test(b.brand))) {
      $$('.btn-glass.lg, .eyebrow.lg, .status.lg, .nav.lg').forEach(el => el.classList.add('lg-refract'));
    }
    const visible = new Set();
    const vis = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    $$('.lg').forEach(el => vis.observe(el));

    let px = -1e4, py = -1e4, queued = false;
    const light = () => {
      queued = false;
      visible.forEach(el => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = px - cx, dy = py - cy;
        el.style.setProperty('--lx', ((px - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--ly', ((py - r.top) / r.height * 100).toFixed(1) + '%');
        el.style.setProperty('--ang', (Math.atan2(-dx, dy) * 57.2958).toFixed(1) + 'deg');
        const ox = Math.max(r.left - px, 0, px - r.right), oy = Math.max(r.top - py, 0, py - r.bottom);
        el.style.setProperty('--near', clamp(1 - Math.hypot(ox, oy) / 180, 0, 1).toFixed(3));
        if (el.classList.contains('lg-jelly') && !reduced) {
          if (ox === 0 && oy === 0) {
            const nx = Math.abs(dx / r.width), ny = Math.abs(dy / r.height);
            el.style.setProperty('--sx', (1 + nx * .07 - ny * .03).toFixed(4));
            el.style.setProperty('--sy', (1 + ny * .07 - nx * .03).toFixed(4));
          } else { el.style.setProperty('--sx', 1); el.style.setProperty('--sy', 1); }
        }
      });
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(light); } };
    addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; queue(); }, { passive: true });
    addEventListener('pointerdown', e => { px = e.clientX; py = e.clientY; queue(); }, { passive: true });
    addEventListener('scroll', queue, { passive: true });

    document.addEventListener('pointerdown', e => {
      const el = e.target.closest('.lg-jelly');
      if (!el) return;
      el.classList.add('press');
      const release = () => {
        el.classList.remove('press');
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    });
  })();
})();
