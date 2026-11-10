/* Light / dark theme — runs in <head> so the first paint is already correct.
   Switching reveals the new theme through an expanding glass lens
   (View Transitions API) led by an iridescent ring, from the click point. */
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('oj-theme'); } catch (e) { /* storage blocked */ }
  root.dataset.theme = saved === 'light' ? 'light' : 'dark';   // dark by default; a visitor's own choice is remembered
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sync = () => {
    const d = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-label]').forEach(el => { el.textContent = d ? 'Light mode' : 'Dark mode'; });
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-pressed', String(d));
      b.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode');
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', d ? '#07080b' : '#f3f1ec');
  };
  const apply = theme => {
    root.dataset.theme = theme;
    try { localStorage.setItem('oj-theme', theme); } catch (e) { /* storage blocked */ }
    sync();
    document.dispatchEvent(new CustomEvent('ojtheme', { detail: theme }));
  };

  const ring = (x, y, r, toDark) => {
    const el = document.createElement('div');
    el.className = 'theme-ring' + (toDark ? ' to-dark' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px';
    document.body.appendChild(el);
    el.animate([
      { width: '0px', height: '0px', opacity: 1, filter: 'blur(0px)' },
      { offset: .75, opacity: .9 },
      { width: r * 2 + 'px', height: r * 2 + 'px', opacity: 0, filter: 'blur(6px)' },
    ], { duration: 1050, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => el.remove();
  };

  let busy = false, t;
  const set = (theme, x, y) => {
    if (busy || theme === root.dataset.theme) return;
    const W = innerWidth, H = innerHeight;
    if (x == null) { x = W - 60; y = 40; }
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 40;
    if (!document.startViewTransition || reduced) {
      root.classList.add('theme-anim'); apply(theme);
      clearTimeout(t); t = setTimeout(() => root.classList.remove('theme-anim'), 750);
      return;
    }
    busy = true;
    root.classList.add('vt-theme');
    const vt = document.startViewTransition(() => apply(theme));
    vt.ready.then(() => {
      // the new theme grows out of the click point as a lens with a soft, wobbling edge
      root.animate({
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r * .18}px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`],
        offset: [0, .22, 1],
      }, { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)', pseudoElement: '::view-transition-new(root)' });
      root.animate({ transform: ['scale(1)', 'scale(.985)'], filter: ['brightness(1)', theme === 'dark' ? 'brightness(.6)' : 'brightness(1.15)'] },
        { duration: 1050, easing: 'cubic-bezier(.65,0,.25,1)', pseudoElement: '::view-transition-old(root)' });
      ring(x, y, r, theme === 'dark');
    }).catch(() => {});
    vt.finished.finally(() => { busy = false; root.classList.remove('vt-theme'); });
  };
  window.ojTheme = { toggle: (x, y) => set(root.dataset.theme === 'dark' ? 'light' : 'dark', x, y), set };
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-theme-toggle]');
      if (!b) return;
      const r = b.getBoundingClientRect();
      const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
      window.ojTheme.toggle(x, y);
    });
  });
})();
