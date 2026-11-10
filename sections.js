/* ==========================================================
   ABOUT (pinned scroll scene + 3D deck + live demos)
   STACK (draggable 3D tool sphere + live stats)
   ========================================================== */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desk = matchMedia('(min-width: 901px)');
  const sY = () => (window.__lenis ? window.__lenis.scroll : window.scrollY);
  const visible = new Set();
  const vio = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)), { rootMargin: '120px 0px' });

  /* ================= ABOUT ================= */
  const about = $('#about'), deck = $('#abDeck');
  if (about && deck) {
    const cards = [...deck.children], dots = $$('#abDots button'), prog = $('#abProg');
    vio.observe(about);

    // statement → words that light up with scroll
    const st = $('#abStatement');
    const walk = (node, inEm) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'aw' + (inEm ? ' em' : ''); w.textContent = part; frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n, inEm || n.tagName === 'EM');
      });
    };
    walk(st, false);
    const words = $$('.aw', st);

    let top = 0, dist = 1, vh = innerHeight, f = 0, fT = 0, dragging = null;
    const measure = () => {
      vh = innerHeight;
      about.style.height = desk.matches && !reduced ? Math.round(vh * 3.4) + 'px' : '';
      top = about.getBoundingClientRect().top + sY();
      dist = Math.max(1, about.offsetHeight - vh);
    };
    // mobile: the statement reveals once, the deck is swiped
    const wio = new IntersectionObserver(([e]) => { if (e.isIntersecting && !desk.matches) { words.forEach((w, i) => { w.style.transitionDelay = (i * 35) + 'ms'; w.style.setProperty('--o', 1); }); } }, { threshold: .3 });
    wio.observe(st);

    deck.addEventListener('pointerdown', e => {
      if (desk.matches) return;
      dragging = { x: e.clientX, f: fT, w: deck.offsetWidth };
    });
    addEventListener('pointermove', e => { if (dragging) fT = clamp(dragging.f - (e.clientX - dragging.x) / (dragging.w * .55), -.3, cards.length - .7); }, { passive: true });
    addEventListener('pointerup', () => { if (dragging) { fT = clamp(Math.round(fT), 0, cards.length - 1); dragging = null; } });
    dots.forEach((d, i) => d.addEventListener('click', () => {
      if (desk.matches) {
        const y = top + (.1 + .84 * i / (cards.length - 1)) * dist;
        if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.2 }); else scrollTo({ top: y, behavior: 'smooth' });
      } else fT = i;
    }));

    about.__update = dt => {
      const k = 1 - Math.pow(.0008, dt);
      if (desk.matches && !reduced) {
        const p = clamp((sY() - top) / dist, 0, 1);
        const wp = clamp(p / .4, 0, 1) * (words.length + 2);
        words.forEach((w, i) => w.style.setProperty('--o', clamp(wp - i, 0, 1).toFixed(3)));
        fT = clamp((p - .1) / .84, 0, 1) * (cards.length - 1);
        if (prog) prog.style.transform = `scaleX(${p})`;
      }
      f = reduced ? fT : lerp(f, fT, clamp(k * 1.6, 0, 1));
      const wide = desk.matches;
      cards.forEach((c, i) => {
        const d = i - f, ad = Math.abs(d);
        const x = wide ? d * 46 : d * 96, z = -ad * (wide ? 330 : 140), ry = -d * (wide ? 30 : 16);
        c.style.transform = `translate3d(${x}%, ${ad * ad * 14}px, ${z}px) rotateY(${ry}deg) rotateZ(${d * 2.2}deg)`;
        c.style.opacity = clamp(1.15 - ad * (wide ? .5 : .75), 0, 1).toFixed(3);
        c.style.zIndex = 100 - Math.round(ad * 10);
        c.classList.toggle('front', ad < .5);
      });
      const cur = Math.round(clamp(f, 0, cards.length - 1));
      dots.forEach((d, i) => d.classList.toggle('on', i === cur));
    };
    addEventListener('resize', measure); addEventListener('load', measure); desk.addEventListener('change', measure);
    document.fonts && document.fonts.ready.then(measure);
    measure();

    /* --- live demo: checkout --- */
    const payBar = $('#payBar'), payStatus = $('#payStatus'), paySteps = $$('.pay-steps span');
    const PAY = [['Paying with Paystack…', 22], ['Payment confirmed ✓', 52], ['Rider assigned · Shipbubble', 80], ['Delivered to Lekki ✓', 100]];
    let payI = 0;
    setInterval(() => {
      if (!visible.has(about)) return;
      payI = (payI + 1) % PAY.length;
      payStatus.classList.remove('swap'); void payStatus.offsetWidth; payStatus.classList.add('swap');
      payStatus.textContent = PAY[payI][0];
      payBar.style.width = PAY[payI][1] + '%';
      paySteps.forEach((s, i) => s.classList.toggle('on', i <= payI));
    }, 1700);
    payBar.style.width = '22%';

    /* --- live demo: AI dashboard --- */
    const line = $('#aiLine'), area = $('#aiArea'), msg = $('#aiMsg'), kpi = $('#aiKpi');
    const pts = Array.from({ length: 34 }, (_, i) => 50 + Math.sin(i * .5) * 12);
    let v = 50, rev = 1.24;
    const draw = () => {
      const step = 300 / (pts.length - 1);
      const d = pts.map((y, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(90 - y).toFixed(1)}`).join('');
      line.setAttribute('d', d); area.setAttribute('d', d + 'L300,90L0,90Z');
    };
    draw();
    setInterval(() => {
      if (!visible.has(about)) return;
      v = clamp(v + (Math.random() - .42) * 9, 18, 82);
      pts.shift(); pts.push(v); draw();
      rev = clamp(rev + (Math.random() - .4) * .01, 1.1, 1.6); kpi.textContent = '₦' + rev.toFixed(2) + 'M';
    }, 160);
    const MSGS = ['Revenue is up 18% this week.', '3 orders need a rider.', 'Peak traffic: 8–10 pm.', 'Top seller: linen two-piece.'];
    let mi = 0;
    const type = async () => {
      while (true) {
        await new Promise(r => setTimeout(r, 2600));
        if (!visible.has(about)) continue;
        mi = (mi + 1) % MSGS.length;
        const t = MSGS[mi]; msg.textContent = '';
        for (let i = 1; i <= t.length; i++) { msg.textContent = t.slice(0, i); await new Promise(r => setTimeout(r, 24)); }
      }
    };
    type();
  }

  /* ================= STACK: tool sphere ================= */
  const orb = $('#stOrb'), list = $('#stTags');
  if (orb && list) {
    vio.observe(orb);
    const TOOLS = [['HTML', 'core'], ['CSS', 'core'], ['JavaScript', 'core'], ['TypeScript', 'core'], ['React', 'core'], ['Tailwind', 'core'],
      ['Three.js', '3d'], ['WebGL', '3d'], ['GLSL', '3d'], ['GSAP', '3d'], ['Lenis', '3d'], ['Framer Motion', '3d'],
      ['PHP', 'back'], ['MySQL', 'back'], ['WordPress', 'back'], ['Node.js', 'back'], ['PWA', 'back'], ['Push API', 'back'],
      ['Paystack', 'com'], ['Shipbubble', 'com'], ['Google Auth', 'com'], ['JWT', 'com'], ['AI APIs', 'com'], ['Leaflet', 'com'],
      ['Vite', 'tool'], ['Figma', 'tool'], ['Playwright', 'tool'], ['Git', 'tool']];
    const n = TOOLS.length;
    const tags = TOOLS.map(([name, g], i) => {
      const li = document.createElement('li');
      li.className = 'st-tag'; li.dataset.g = g; li.textContent = name;
      list.appendChild(li);
      const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;   // fibonacci sphere
      return { el: li, x: Math.cos(th) * r, y, z: Math.sin(th) * r };
    });
    let rx = -.25, ry = 0, vx = 0, vy = .0035, drag = null, R = 160, hoverG = null;
    const size = () => { R = orb.offsetWidth * .4; };
    size(); addEventListener('resize', size);
    orb.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; orb.classList.add('grab'); orb.setPointerCapture?.(e.pointerId); });
    orb.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      vy = dx * .0009; vx = -dy * .0009; ry += dx * .006; rx = clamp(rx - dy * .006, -1.2, 1.2);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = () => { drag = null; orb.classList.remove('grab'); };
    orb.addEventListener('pointerup', end); orb.addEventListener('pointercancel', end);
    $$('#stLegend li').forEach(li => {
      li.addEventListener('pointerenter', () => { hoverG = li.dataset.g; orb.classList.add('filter'); tags.forEach(t => t.el.classList.toggle('hl', t.el.dataset.g === hoverG)); });
      li.addEventListener('pointerleave', () => { hoverG = null; orb.classList.remove('filter'); tags.forEach(t => t.el.classList.remove('hl')); });
    });
    // mouse → whole orb tilts in 3D, core follows, sphere drifts toward the cursor
    const core = $('.st-core', orb);
    let hmx = 0, hmy = 0, smx = 0, smy = 0, spin = 0;
    orb.addEventListener('pointermove', e => { const r = orb.getBoundingClientRect(); hmx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); hmy = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1); });
    orb.addEventListener('pointerleave', () => { hmx = 0; hmy = 0; });
    orb.__update = dt => {
      smx = lerp(smx, hmx, .08); smy = lerp(smy, hmy, .08);
      if (!drag) { vy = lerp(vy, .0035 + smx * .006, .03); vx = lerp(vx, smy * -.002, .04); ry += vy * dt * 60; rx = clamp(rx + vx * dt * 60, -1.2, 1.2); rx = lerp(rx, -.25 + smy * .35, .01); }
      spin = lerp(spin, clamp((Math.abs(vy) + Math.abs(vx) - .0045) * 110, 0, 1), .12);
      orb.style.setProperty('--spin', spin.toFixed(3));
      orb.style.transform = `perspective(1100px) rotateX(${(-smy * 12).toFixed(2)}deg) rotateY(${(smx * 14).toFixed(2)}deg)`;
      core.style.transform = `translate3d(${(smx * 18).toFixed(1)}px, ${(smy * 18).toFixed(1)}px, 0) scale(${(1 + spin * .08).toFixed(3)})`;
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      tags.forEach(t => {
        const x1 = t.x * cy + t.z * sy, z1 = -t.x * sy + t.z * cy;
        const y2 = t.y * cx - z1 * sx, z2 = t.y * sx + z1 * cx;
        const s = .62 + .48 * (z2 + 1) / 2;
        t.el.style.transform = `translate3d(${(x1 * R).toFixed(1)}px, ${(y2 * R).toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
        t.el.style.opacity = (.22 + .78 * (z2 + 1) / 2).toFixed(3);
        t.el.style.zIndex = Math.round((z2 + 1) * 50);
      });
    };
  }

  /* ================= STACK: live stats ================= */
  const fpsNum = $('#fpsNum'), spark = $('#fpsSpark');
  const stats = $('.st-stats');
  if (stats) vio.observe(stats);
  const samples = [];
  let fAcc = 0, fN = 0;
  const drawSpark = () => {
    if (!spark) return;
    const x = spark.getContext('2d'), w = spark.width, h = spark.height;
    x.clearRect(0, 0, w, h);
    const col = getComputedStyle(document.documentElement).getPropertyValue('--gold-ink').trim() || '#8a6830';
    x.strokeStyle = col; x.lineWidth = 2; x.beginPath();
    samples.forEach((v, i) => { const px = i / 39 * w, py = h - 6 - clamp(v / 70, 0, 1) * (h - 12); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
    x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.globalAlpha = .12; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
  };
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, to = +el.dataset.count, t0 = performance.now();
    const step = now => { const p = clamp((now - t0) / 1400, 0, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ================= loop ================= */
  let last = performance.now();
  const loop = now => {
    requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (about && about.__update && visible.has(about)) about.__update(dt);
    if (orb && orb.__update && visible.has(orb)) orb.__update(dt);
    if (stats && visible.has(stats)) {
      fAcc += dt; fN++;
      if (fAcc >= .5) { const fps = Math.min(240, Math.round(fN / fAcc)); fpsNum.textContent = fps; samples.push(fps); if (samples.length > 40) samples.shift(); drawSpark(); fAcc = 0; fN = 0; }
    }
  };
  requestAnimationFrame(loop);
})();
