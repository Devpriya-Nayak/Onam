/* ═══════════════════════════════════════════════
   ONAM · Nitya Electronics, Kanhangad

   All artwork is transparent PNG in /assets.
   Every image degrades gracefully: if a file is not
   there yet the page still works and shows which
   filename is missing.
   ═══════════════════════════════════════════════ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Flower cutouts reused by the petal rain and the pookalam. */
const FLOWER_FILES = [
  'assets/flower-1.png',
  'assets/flower-2.png',
  'assets/flower-3.png',
  'assets/flower-4.png',
  'assets/flower-5.png'
];
/* Fallback colours, used only while the PNGs are missing. */
const FALLBACK_COLORS = ['#F2A93B', '#E8871E', '#8C1D18', '#C43C2E', '#7FB069', '#C9A227', '#FFF3D6', '#E4572E'];

/* ─────────── 0. Missing-image placeholders ─────────── */
(function artSlots() {
  document.querySelectorAll('.art-slot img').forEach(img => {
    const slot = img.closest('.art-slot');
    if (!slot) return;
    const missing = () => slot.classList.add('missing');
    const found = () => slot.classList.remove('missing');

    img.addEventListener('error', missing);
    img.addEventListener('load', found);

    // Most of these are loading="lazy", so they only report once they scroll
    // into view. Probe eagerly as well, so a not-yet-created file is labelled
    // immediately instead of leaving a silent gap.
    const probe = new Image();
    probe.onerror = missing;
    probe.onload = found;
    probe.src = img.currentSrc || img.src;
  });
})();

/* ─────────── 0b. Optional photo behind each offer card ───────────
   assets/offer1.png … offer4.png. Drop a file in and that card switches
   to photo mode; leave it out and the cream kasavu card stands as-is.   */
(function offerPhotos() {
  document.querySelectorAll('.offer-card').forEach(card => {
    const imgs = [...card.querySelectorAll('.oc-media img')].filter(i => i.dataset.src);
    if (!imgs.length) return;

    // Paths sit in data-src, not src. Probe first and only attach the real src
    // once it loads: a card with no photo then costs one request instead of a
    // request plus a broken <img>, and logs no console error.
    let ready = 0;
    imgs.forEach(img => {
      const probe = new Image();
      probe.onload = () => {
        img.src = img.dataset.src;
        card.classList.add('has-photo');
        // only start the cross-fade once BOTH photos are decoded, otherwise
        // the card would fade to an empty frame on the first cycle
        if (++ready === imgs.length && imgs.length > 1) card.classList.add('has-two');
      };
      probe.src = img.dataset.src;
    });
  });
})();

/* Load the flower set once; resolves to whatever actually loaded. */
const flowerImages = (() => {
  const loaded = [];
  let done = false;
  const pending = FLOWER_FILES.map(src => new Promise(resolve => {
    const im = new Image();
    im.onload = () => { loaded.push(im); resolve(); };
    im.onerror = () => resolve();
    im.src = src;
  }));
  const ready = Promise.all(pending).then(() => { done = true; return loaded; });
  return { list: loaded, ready, get done() { return done; } };
})();

/* ─────────── 1. Scroll reveals ─────────── */
(function reveals() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduceMotion) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('in'), i * 90);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  items.forEach(el => io.observe(el));

  // Safety net. The observer is the primary path — it gives the nicer
  // staggered timing — but it can call back reporting nothing and then go
  // quiet (a tab that never paints, an aggressively throttled load). Judging
  // it by "did it call back" is not enough, so instead we simply keep a cheap
  // scroll check running until everything has actually been shown. Both paths
  // only ever ADD the class, so they cannot fight each other.
  const sweep = () => {
    let pending = 0;
    items.forEach(el => {
      if (el.classList.contains('in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) el.classList.add('in');
      else pending++;
    });
    if (!pending) {                      // everything is out — stop listening
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onShow);
    }
  };
  // Throttled on the clock, not on requestAnimationFrame: rAF does not run at
  // all while a tab is hidden, so an rAF-gated check would stall on a page
  // opened in a background tab and never recover.
  let last = 0;
  const onScroll = () => {
    const now = Date.now();
    if (now - last < 100) return;
    last = now;
    sweep();
  };
  const onShow = () => { if (!document.hidden) sweep(); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onShow);
  setTimeout(sweep, 2500);
})();

/* ─────────── 2. Falling petals ─────────── */
(function petalRain() {
  const canvas = document.getElementById('petals');
  if (!canvas || reduceMotion) return;
  const ctx = canvas.getContext('2d');
  let w, h, petals = [], raf = null;

  function size() {
    // clientWidth/Height = the layout viewport WITHOUT any scrollbar, so the
    // overlay can never be wider than the page and cause sideways scrolling.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = document.documentElement.clientWidth;
    h = document.documentElement.clientHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePetal(above) {
    const imgs = flowerImages.list;
    return {
      x: Math.random() * w,
      y: above ? -30 : Math.random() * h,
      size: 14 + Math.random() * 20,
      img: imgs.length ? imgs[(Math.random() * imgs.length) | 0] : null,
      color: FALLBACK_COLORS[(Math.random() * FALLBACK_COLORS.length) | 0],
      vy: 0.35 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.7,
      spin: (Math.random() - 0.5) * 0.03,
      angle: Math.random() * Math.PI * 2,
      alpha: 0.55 + Math.random() * 0.4,
      sway: Math.random() * Math.PI * 2
    };
  }

  function seed() {
    const count = window.innerWidth < 600 ? 16 : 30;
    petals = Array.from({ length: count }, () => makePetal(false));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    petals.forEach(p => {
      p.sway += 0.012;
      p.y += p.vy;
      p.x += p.drift + Math.sin(p.sway) * 0.6;
      p.angle += p.spin;
      if (p.y > h + 40) Object.assign(p, makePetal(true));
      if (p.x < -40) p.x = w + 30;
      if (p.x > w + 40) p.x = -30;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = p.alpha;
      if (p.img) {
        ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.36, p.size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    raf = requestAnimationFrame(draw);
  }

  size(); seed(); draw();
  // once the PNGs arrive, hand them to the petals already on screen
  flowerImages.ready.then(imgs => {
    if (!imgs.length) return;
    petals.forEach(p => { p.img = imgs[(Math.random() * imgs.length) | 0]; });
  });

  window.addEventListener('resize', () => { size(); seed(); });
  window.addEventListener('orientationchange', () => { size(); seed(); });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => size()).observe(document.documentElement);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf) draw();
  });
})();

/* ─────────── 3. Interactive pookalam ─────────── */
(function livePookalam() {
  const wrap = document.getElementById('pookWrap');
  const canvas = document.getElementById('pookCanvas');
  const base = wrap && wrap.querySelector('.pook-base');
  const countEl = document.getElementById('flowerCount');
  const addBtn = document.getElementById('addFlower');
  const resetBtn = document.getElementById('resetPookalam');
  const note = document.getElementById('countNote');
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext('2d');
  const SIZE = canvas.width;          // 1200 — the coordinate space we store
  const C = SIZE / 2;
  const OUTER = SIZE * 0.46;
  const INNER = SIZE * 0.10;
  // v3: coordinates are stored in the canvas's own pixel space (see SIZE)
  const KEY = 'onam-pookalam-v3';
  const MAX = 300;
  let flowers = [];

  // If the base PNG is missing, draw guide rings so the circle still reads.
  if (base) {
    base.addEventListener('error', () => { base.classList.add('hidden'); redraw(); });
    if (base.complete && base.naturalWidth === 0) base.classList.add('hidden');
  }
  const baseMissing = () => !base || base.classList.contains('hidden');

  try {
    flowers = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(flowers)) flowers = [];
  } catch (e) { flowers = []; }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(flowers.slice(-MAX))); } catch (e) { /* private mode */ }
  };

  function drawGuides() {
    ctx.save();
    ctx.strokeStyle = 'rgba(220,201,143,.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 18]);
    [OUTER, OUTER * 0.74, OUTER * 0.48, OUTER * 0.24].forEach(r => {
      ctx.beginPath();
      ctx.arc(C, C, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawOne(f) {
    const imgs = flowerImages.list;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate((f.rot * Math.PI) / 180);
    if (imgs.length) {
      const img = imgs[f.i % imgs.length];
      ctx.drawImage(img, -f.s / 2, -f.s / 2, f.s, f.s);
    } else {
      // simple drawn blossom until the PNGs are added
      const c = FALLBACK_COLORS[f.i % FALLBACK_COLORS.length];
      ctx.fillStyle = c;
      for (let p = 0; p < 6; p++) {
        ctx.save();
        ctx.rotate((p / 6) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -f.s * 0.3, f.s * 0.2, f.s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#FFF8EC';
      ctx.beginPath();
      ctx.arc(0, 0, f.s * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (baseMissing()) drawGuides();
    flowers.forEach(drawOne);
    countEl.textContent = flowers.length;
  }

  function addAt(x, y) {
    if (flowers.length >= MAX) {
      note.textContent = 'The pookalam is full — that is a beautiful problem to have. 🌼';
      return;
    }
    flowers.push({
      x: Math.round(x), y: Math.round(y),
      s: Math.round(70 + Math.random() * 60),
      rot: Math.round(Math.random() * 360),
      i: (Math.random() * 1000) | 0
    });
    redraw();
    save();
  }

  function randomPoint() {
    const a = Math.random() * Math.PI * 2;
    const r = INNER + Math.sqrt(Math.random()) * (OUTER - INNER);
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  }

  wrap.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * SIZE;
    const y = ((ev.clientY - rect.top) / rect.height) * SIZE;
    const d = Math.hypot(x - C, y - C);
    if (d > OUTER) return;                                   // outside the ring
    if (d < INNER) { const [rx, ry] = randomPoint(); addAt(rx, ry); return; }
    addAt(x, y);
  });

  addBtn && addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const [x, y] = randomPoint();
    addAt(x, y);
  });

  resetBtn && resetBtn.addEventListener('click', () => {
    flowers = [];
    save();
    redraw();
    note.textContent = 'A clean doorstep. Start again. 🌼';
  });

  redraw();
  flowerImages.ready.then(redraw);   // repaint properly once the PNGs load
})();

/* ─────────── 4. Wish card maker ─────────── */
(function wishMaker() {
  const toIn = document.getElementById('toName');
  const fromIn = document.getElementById('fromName');
  const pick = document.getElementById('wishPick');
  const cardTo = document.getElementById('cardTo');
  const cardFrom = document.getElementById('cardFrom');
  const cardLine = document.getElementById('cardLine');
  const copyBtn = document.getElementById('copyWish');
  const shuffleBtn = document.getElementById('shuffleWish');
  const msg = document.getElementById('copiedMsg');
  if (!toIn || !cardLine) return;

  const WISHES = [
    'May Maveli find your home full of light, your table full of people, and your year full of easy days.',
    'Wishing you a year as generous as a sadya — a little of everything good, and always one more helping.',
    'Ten days of flowers at your door, and a lifetime of the kind of days worth decorating for.',
    'ഹൃദയം നിറഞ്ഞ ഓണാശംസകൾ. May this Onam bring health, peace and plenty to your whole family.',
    'Wherever you are reading this from, may this Onam carry the smell of home to you — sadya, rain and all.'
  ];

  function render() {
    const to = toIn.value.trim();
    const from = fromIn.value.trim();
    cardTo.textContent = to ? `Dear ${to},` : 'Dear friend,';
    cardFrom.textContent = from ? `— ${from}` : '— with love';
    cardLine.textContent = WISHES[+pick.value] || WISHES[0];
  }

  function plainText() {
    const to = toIn.value.trim();
    const from = fromIn.value.trim();
    return [
      '🌼 ഹൃദയം നിറഞ്ഞ ഓണാശംസകൾ 🌼',
      '',
      to ? `Dear ${to},` : 'Dear friend,',
      WISHES[+pick.value] || WISHES[0],
      '',
      from ? `— ${from}` : '— with love',
      'Nitya Electronics, Kanhangad'
    ].join('\n');
  }

  function flash(text) {
    msg.textContent = text;
    msg.classList.add('show');
    clearTimeout(flash.t);
    flash.t = setTimeout(() => msg.classList.remove('show'), 2600);
  }

  [toIn, fromIn, pick].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  shuffleBtn && shuffleBtn.addEventListener('click', () => {
    let n = +pick.value;
    while (WISHES.length > 1 && n === +pick.value) n = (Math.random() * WISHES.length) | 0;
    pick.value = String(n);
    render();
  });

  copyBtn && copyBtn.addEventListener('click', async () => {
    const text = plainText();
    try {
      await navigator.clipboard.writeText(text);
      flash('Copied — now paste it into WhatsApp 🌼');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); flash('Copied — now paste it into WhatsApp 🌼'); }
      catch (err) { flash('Select the card text and copy it manually.'); }
      document.body.removeChild(ta);
    }
  });

  render();
})();
