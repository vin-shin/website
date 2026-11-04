// projects array lives in projects-data.js (loaded before this script)

// ── Render project cards ──────────────────────────────────────────
function buildThumb(p) {
  if (p.model) {
    const t = p.modelOrbit ? p.modelOrbit.theta : 0;
    const ph = p.modelOrbit ? p.modelOrbit.phi   : 90;
    const overlay = p.thumb
      ? `<img src="${p.thumb}" aria-hidden="true" class="thumb-overlay" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity 0.6s ease;" />`
      : '';
    return `<div style="position:relative;width:100%;height:100%;">
      <model-viewer src="${p.model}" camera-orbit="${t}deg ${ph}deg auto" data-project-id="${p.id}" interaction-prompt="none" shadow-intensity="0" exposure="0.5" touch-action="pan-y" style="width:100%;height:100%;background:var(--bg);display:block;"></model-viewer>
      ${overlay}
    </div>`;
  }
  if (p.image) {
    return `<img src="${p.image}" alt="${p.title}" loading="lazy" style="width:100%;height:220px;object-fit:cover;display:block;" />`;
  }
  return `
    <div class="project-thumb-placeholder" style="background:${p.gradient};height:220px;">
      ${p.icon}
    </div>`;
}

function buildCard(p) {
  const MAX_TAGS = 3;
  const visibleTags = p.tags.slice(0, MAX_TAGS);
  const extra = p.tags.length - MAX_TAGS;

  return `
    <a href="project.html?id=${p.id}" class="project-card reveal" aria-label="View details for ${p.title}">
      <div class="project-thumb">${buildThumb(p)}</div>
      <div class="project-body">
        <div class="project-header">
          <div>
            <h3 class="project-title">${p.title}</h3>
            <span class="project-context">${p.context}</span>
          </div>
          <span class="project-date">${p.date}</span>
        </div>
        <p class="project-summary">${p.summary}</p>
        <div class="project-footer">
          <div class="project-tags">
            ${visibleTags.map(t => `<span class="tag">${t}</span>`).join('')}
            ${extra > 0 ? `<span class="tag">+${extra}</span>` : ''}
          </div>
          <span class="project-more">Details ↗</span>
        </div>
      </div>
    </a>`;
}

const grid = document.getElementById('projects-grid');
grid.innerHTML = projects.map(buildCard).join('');

grid.querySelectorAll('model-viewer').forEach(mv => {
  const proj = projects.find(p => p.id === mv.dataset.projectId);
  const REST_THETA = proj && proj.modelOrbit ? proj.modelOrbit.theta : 0;
  const REST_PHI   = proj && proj.modelOrbit ? proj.modelOrbit.phi   : 90;
  const THETA_K = 0.022, THETA_B = 0.08;
  const PHI_K   = 0.038, PHI_B   = 0.12;

  let theta = REST_THETA, phi = REST_PHI;
  let dTheta = 0, dPhi = 0;
  let hovered = false, driveTime = 0, animId = null;

  function physTick() {
    driveTime += 0.012;

    if (hovered) {
      dTheta += 0.012;
    } else {
      const snap = Math.round((theta - REST_THETA) / 360) * 360 + REST_THETA;
      dTheta += -THETA_K * (theta - snap);
    }
    dTheta *= (1 - THETA_B);
    theta  += dTheta;

    dPhi += -PHI_K * (phi - REST_PHI) + (hovered ? Math.sin(driveTime * 0.4) * 0.18 : 0);
    dPhi *= (1 - PHI_B);
    phi  += dPhi;
    phi   = Math.max(15, Math.min(165, phi));

    mv.setAttribute('camera-orbit', `${theta}deg ${phi}deg auto`);

    if (!hovered && Math.abs(dTheta) < 0.04 && Math.abs(dPhi) < 0.04 && Math.abs(phi - REST_PHI) < 0.25) {
      theta = REST_THETA; phi = REST_PHI; dTheta = 0; dPhi = 0; driveTime = 0;
      mv.setAttribute('camera-orbit', `${REST_THETA}deg ${REST_PHI}deg auto`);
      animId = null;
      return;
    }
    animId = requestAnimationFrame(physTick);
  }

  mv.addEventListener('load', () => {
    const overlay = mv.parentElement.querySelector('.thumb-overlay');
    if (overlay) overlay.style.opacity = '0';
  });

  mv.addEventListener('mouseenter', () => {
    hovered = true;
    if (!animId) animId = requestAnimationFrame(physTick);
  });
  mv.addEventListener('mouseleave', () => {
    hovered = false;
    if (!animId) animId = requestAnimationFrame(physTick);
  });
});

// ── Scroll reveal ─────────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  const intersecting = entries
    .filter(e => e.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
  intersecting.forEach((entry, i) => {
    setTimeout(() => {
      entry.target.classList.add('visible');
      setTimeout(() => entry.target.classList.add('settled'), 750);
    }, i * 90);
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

function startReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// ── Photo card slideshow ──────────────────────────────────────────
// Slides through photos of me every few seconds; clicking the card skips ahead.
const photoFrame = document.querySelector('.photo-frame');
if (photoFrame) {
  const photos = [...photoFrame.querySelectorAll('img')];
  let current = 0, cycle = null;

  // load the rest only after the page has loaded, so they don't compete with it
  addEventListener('load', () => photos.forEach(img => {
    if (!img.dataset.src) return;
    img.onload = () => img.classList.add('loaded');
    img.src = img.dataset.src;
  }));

  // The photos on screen sit side by side on one strip that slides left, so they always move
  // together and rapid clicks can't open a gap between them. Each photo gets the next slot on
  // the strip when it's shown; once its slot is fully off the left edge it drops off and waits
  // at the right edge again.
  const slots = new Map([[photos[0], 0]]);
  let pos = 0, target = 0, glide = null;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const easeOut = t => 1 - (1 - t) ** 3; // when a click lands mid-slide, carry on without stalling
  const place = () => {
    for (const [img, slot] of slots) {
      if (slot - pos <= -1) { slots.delete(img); img.style.transform = ''; }
      else img.style.transform = `translateX(${(slot - pos) * 100}%)`;
    }
  };
  const show = i => {
    photos[current].classList.remove('active');
    current = i;
    photos[i].classList.add('active');
    slots.set(photos[i], ++target);
    const from = pos, start = performance.now(), ease = glide ? easeOut : easeInOut;
    cancelAnimationFrame(glide);
    const step = now => {
      const t = Math.min((now - start) / 800, 1);
      pos = from + (target - from) * ease(t);
      place();
      glide = t < 1 ? requestAnimationFrame(step) : null;
    };
    glide = requestAnimationFrame(step);
  };
  const next = () => {
    // skip photos that haven't loaded yet or are still on the strip
    for (let k = 1; k < photos.length; k++) {
      const i = (current + k) % photos.length;
      if (photos[i].classList.contains('loaded') && !slots.has(photos[i])) return show(i);
    }
  };
  const start = () => { clearInterval(cycle); cycle = setInterval(next, 5000); };
  photoFrame.addEventListener('click', () => { next(); start(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(cycle) : start()));
  start();
}

// ── Signature intro ───────────────────────────────────────────────
// Draw the logo, fade it out, then let the cards reveal. Click or any key skips.
const intro = document.querySelector('.intro');
if (document.documentElement.classList.contains('intro-active') && intro) {
  // Gather the aurora blobs behind the logo so they act as its glow.
  // `translate`/`scale` stack on top of each blob's own drift animation (which uses `transform`).
  const blobs = [...document.querySelectorAll('.aurora .blob')];
  const cx = innerWidth / 2, cy = innerHeight / 2;
  blobs.forEach(b => {
    const r = b.getBoundingClientRect();
    b.style.translate = `${cx - (r.left + r.width / 2)}px ${cy - (r.top + r.height / 2)}px`;
    b.style.scale = '0.6';
  });
  document.documentElement.classList.add('intro-gather');
  // bloom in as the signature finishes drawing
  const bloom = setTimeout(() => document.documentElement.classList.add('intro-bloom'), 600);

  const explode = () => {
    document.documentElement.classList.add('intro-bloom');
    blobs.forEach(b => {
      b.style.transition = 'translate 1.8s cubic-bezier(.16, 1, .3, 1), scale 1.8s cubic-bezier(.16, 1, .3, 1), opacity 0.4s ease';
      b.style.translate = '0px 0px';
      b.style.scale = '1';
    });
    setTimeout(() => {
      document.documentElement.classList.remove('intro-gather', 'intro-bloom');
      blobs.forEach(b => { b.style.transition = ''; b.style.translate = ''; b.style.scale = ''; });
    }, 1900);
  };

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(bloom);
    intro.classList.add('leaving');
    explode();
    // let the logo get mostly out of the way before the cards start coming in
    setTimeout(startReveal, 320);
    setTimeout(() => {
      document.documentElement.classList.remove('intro-active');
      intro.remove();
      window.__unlockScroll?.();
    }, 500);
  };
  const timer = setTimeout(finish, 1750); // 0.15s delay + 1.25s draw + short hold with the glow
  intro.addEventListener('click', finish);
  addEventListener('keydown', finish, { once: true });
} else {
  intro?.remove();
  startReveal();
}
