// projects array lives in projects-data.js (loaded before this script)

// ── Hero name hover swap ──────────────────────────────────────────
(function () {
  const el = document.querySelector('.hero-name');
  if (!el) return;
  const original = 'Vin Shin';
  const alternate = 'shin.vin';
  let swapped = false;

  function swap(to) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = to;
      el.style.opacity = '1';
    }, 250);
  }

  el.addEventListener('mouseenter', () => { if (!swapped) { swap(alternate); swapped = true; } });
  el.addEventListener('mouseleave', () => { if (swapped)  { swap(original);  swapped = false; } });
})();

// ── Render project cards ──────────────────────────────────────────
function buildThumb(p) {
  if (p.model) {
    const t = p.modelOrbit ? p.modelOrbit.theta : 0;
    const ph = p.modelOrbit ? p.modelOrbit.phi   : 90;
    const overlay = p.thumb
      ? `<img src="${p.thumb}" aria-hidden="true" class="thumb-overlay" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity 0.6s ease;" />`
      : '';
    return `<div style="position:relative;width:100%;height:100%;">
      <model-viewer src="${p.model}" camera-orbit="${t}deg ${ph}deg auto" data-project-id="${p.id}" interaction-prompt="none" shadow-intensity="0" exposure="0.5" touch-action="pan-y" style="width:100%;height:100%;background:#0f110c;display:block;"></model-viewer>
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

// ── Hero title animation: "Shin.Vin" → "Vin Shin" ────────────────
function animateHeroTitle() {
  const h1 = document.querySelector('.hero-name');
  if (!h1) return;

  h1.style.display = 'flex';
  h1.style.position = 'relative';
  h1.style.whiteSpace = 'nowrap';

  // Render "Shin.Vin" and measure positions
  h1.innerHTML = '<span>Shin</span><span style="margin:0 -0.04em">.</span><span>Vin</span>';
  const [sEl, dEl, vEl] = h1.children;
  const sR = sEl.getBoundingClientRect();
  const dR = dEl.getBoundingClientRect();
  const vR = vEl.getBoundingClientRect();
  const h1R = h1.getBoundingClientRect();

  // Switch to "Vin Shin" DOM and measure
  h1.innerHTML = '<span class="ha">Vin</span><span class="hb" style="opacity:0">&nbsp;</span><span class="hc">Shin</span>';
  const ha = h1.querySelector('.ha');
  const hb = h1.querySelector('.hb');
  const hc = h1.querySelector('.hc');
  const aR = ha.getBoundingClientRect();
  const cR = hc.getBoundingClientRect();

  // Floating dot overlay at original measured position
  const dot = document.createElement('span');
  dot.textContent = '.';
  dot.style.cssText = `position:absolute;left:${dR.left - h1R.left}px;top:0;pointer-events:none;`;
  h1.appendChild(dot);

  // Snap to "Shin.Vin" appearance via inverse transforms
  ha.style.transform = `translateX(${vR.left - aR.left}px)`;
  hc.style.transform = `translateX(${sR.left - cR.left}px)`;

  // Animate after hero panel finishes revealing
  setTimeout(() => {
    const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
    ha.style.transition = `transform 0.65s ${ease}`;
    hc.style.transition = `transform 0.65s ${ease}`;
    hb.style.transition = 'opacity 0.3s ease 0.4s';
    dot.style.transition = 'opacity 0.3s ease';
    ha.style.transform = '';
    hc.style.transform = '';
    hb.style.opacity = '1';
    dot.style.opacity = '0';
  }, 700);

  // Cleanup — restore plain text
  setTimeout(() => {
    h1.textContent = 'Vin Shin';
    h1.style.display = '';
    h1.style.position = '';
    h1.style.whiteSpace = '';
  }, 1450);
}

animateHeroTitle();

// ── Scroll reveal ─────────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  const intersecting = entries
    .filter(e => e.isIntersecting)
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
  intersecting.forEach((entry, i) => {
    setTimeout(() => entry.target.classList.add('visible'), i * 80);
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
