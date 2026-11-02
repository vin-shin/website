// ── Aurora motion ─────────────────────────────────────────────────
// A small physics sim for the background blobs. Each blob is pulled toward a slowly wandering
// anchor, pushes away from blobs that get too close, is drawn toward blobs at medium range
// (so they swirl around each other instead of stacking), and leans toward the cursor.
// Every few seconds one blob is flung toward the emptiest part of the screen.
// The CSS drift keyframes stay as the fallback when this script doesn't run.
(() => {
  const aurora = document.querySelector('.aurora');
  const blobs = aurora ? [...aurora.querySelectorAll('.blob')] : [];
  if (!blobs.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  aurora.classList.add('js-motion');

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // resting centers (without transforms); positions below are in the same viewport coords
  let homes = [];
  const measure = () => {
    homes = blobs.map(b => ({ x: b.offsetLeft + b.offsetWidth / 2, y: b.offsetTop + b.offsetHeight / 2, r: b.offsetWidth * 0.32 }));
  };
  measure();
  addEventListener('resize', measure);

  const state = blobs.map((_, i) => ({
    x: homes[i].x, y: homes[i].y, vx: 0, vy: 0,
    // anchor the blob is pulled toward; starts at home, moves when the blob darts
    anchorX: homes[i].x, anchorY: homes[i].y,
    // the anchor itself wanders on slow waves so blobs never fully settle
    ax: rand(90, 180), ay: rand(70, 150),
    fx: rand(0.1, 0.22), fy: rand(0.09, 0.2), px: rand(0, 6.28), py: rand(0, 6.28),
    bf: rand(0.25, 0.45), bp: rand(0, 6.28), // breathing
    depth: rand(0.4, 1), // how strongly it's drawn to the cursor
  }));

  // cursor position plus a smoothed velocity, so moving the mouse can stir nearby blobs
  let cx = null, cy = null, mvx = 0, mvy = 0, lastMove = null;
  addEventListener('pointermove', e => {
    const now = performance.now();
    if (cx !== null && lastMove !== null) {
      const dtm = Math.max(8, now - lastMove) / 1000;
      mvx += ((e.clientX - cx) / dtm - mvx) * 0.3;
      mvy += ((e.clientY - cy) / dtm - mvy) * 0.3;
    }
    cx = e.clientX; cy = e.clientY; lastMove = now;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { cx = cy = null; mvx = mvy = 0; });

  // While the homepage intro has the blobs gathered behind the logo, hold them at home,
  // then ease into full motion as they burst outward
  const root = document.documentElement;
  let calm = null;
  let nextDart = 2.5, last = null;

  // Pick an on-screen spot far from every other blob (and a real distance from this one),
  // so darts spread things out and actually cross the screen
  function emptiestSpot(skip) {
    let best = null, bestD = -1;
    const minTravel = 0.35 * Math.min(innerWidth, innerHeight);
    for (let n = 0; n < 40; n++) {
      const x = rand(0.1, 0.9) * innerWidth, y = rand(0.1, 0.9) * innerHeight;
      if (Math.hypot(skip.x - x, skip.y - y) < minTravel) continue;
      const d = Math.min(...state.filter(p => p !== skip).map(p => Math.hypot(p.x - x, p.y - y)));
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best;
  }

  function tick(t) {
    const s = t / 1000;
    const dt = last === null ? 0 : Math.min(0.05, s - last);
    last = s;
    const calmTarget = root.classList.contains('intro-gather') ? 0 : 1;
    calm = calm === null ? calmTarget : calm + (calmTarget - calm) * 0.025;
    const live = calm > 0.5;

    if (live && s > nextDart) {
      nextDart = s + rand(5.5, 6.5);
      // one of the two most crowded blobs (closest to a neighbor) darts away
      const nearest = q => Math.min(...state.filter(o => o !== q).map(o => Math.hypot(o.x - q.x, o.y - q.y)));
      const crowded = [...state].sort((a, b) => nearest(a) - nearest(b));
      const p = crowded[Math.random() < 0.5 ? 0 : 1];
      const to = emptiestSpot(p) || { x: rand(0.1, 0.9) * innerWidth, y: rand(0.1, 0.9) * innerHeight };
      p.anchorX = to.x; p.anchorY = to.y;
      // fling it: a quick glide over a second or two, then the anchor spring carries it the rest of the way
      p.vx += (to.x - p.x) * 1.6;
      p.vy += (to.y - p.y) * 1.6;
    }

    // the stir fades out once the mouse stops moving
    const still = Math.exp(-6 * dt);
    mvx *= still; mvy *= still;

    if (live) {
      const forces = state.map(() => ({ x: 0, y: 0 }));
      state.forEach((p, i) => {
        const f = forces[i];
        // spring toward the wandering anchor
        const ax = p.anchorX + p.ax * Math.sin(s * p.fx + p.px);
        const ay = p.anchorY + p.ay * Math.sin(s * p.fy + p.py);
        f.x += (ax - p.x) * 0.9;
        f.y += (ay - p.y) * 0.9;

        // blob-to-blob: repel when overlapping, gentle pull at medium range
        for (let j = i + 1; j < state.length; j++) {
          const q = state[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const rest = (homes[i].r + homes[j].r) * 1.15;
          let k = 0;
          // push apart, getting much stiffer the deeper they overlap so fast darts can't pass through
          if (d < rest) k = -9 * (rest - d) * (1 + 6 * (rest - d) / rest);
          else if (d < rest * 2.2) k = 0.6 * (d - rest) * (rest * 2.2 - d) / rest; // soft attraction, fades out
          const ux = dx / d, uy = dy / d;
          f.x += ux * k; f.y += uy * k;
          forces[j].x -= ux * k; forces[j].y -= uy * k;
        }

        if (cx !== null) {
          const dx = cx - p.x, dy = cy - p.y;
          const d = Math.hypot(dx, dy);
          // faintly drawn toward the cursor when it's nearby
          const pull = Math.max(0, 1 - d / 650) * 1.1 * p.depth;
          f.x += dx * pull; f.y += dy * pull;
          // stir: moving the mouse drags nearby blobs along in the same direction
          const reach = Math.max(0, 1 - d / 520);
          const stir = reach * reach * 2.4 * p.depth;
          f.x += mvx * stir; f.y += mvy * stir;
        }

        // soft walls so nothing leaves the screen for long
        const m = 40;
        if (p.x < -m) f.x += (-m - p.x) * 14;
        if (p.x > innerWidth + m) f.x -= (p.x - innerWidth - m) * 14;
        if (p.y < -m) f.y += (-m - p.y) * 14;
        if (p.y > innerHeight + m) f.y -= (p.y - innerHeight - m) * 14;
      });

      const damp = Math.exp(-1.7 * dt);
      state.forEach((p, i) => {
        p.vx = (p.vx + forces[i].x * dt) * damp;
        p.vy = (p.vy + forces[i].y * dt) * damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      });
    }

    blobs.forEach((b, i) => {
      const p = state[i], h = homes[i];
      const speed = Math.hypot(p.vx, p.vy);
      const stretch = 1 + clamp(speed / 1400, 0, 0.45); // stretch along the direction of travel
      const angle = Math.atan2(p.vy, p.vx);
      const breathe = 1 + 0.14 * Math.sin(s * p.bf + p.bp);
      const x = (p.x - h.x) * calm, y = (p.y - h.y) * calm;
      b.style.transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ` +
        `rotate(${angle.toFixed(3)}rad) scale(${(breathe * stretch).toFixed(3)}, ${(breathe / Math.sqrt(stretch)).toFixed(3)}) rotate(${(-angle).toFixed(3)}rad)`;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
