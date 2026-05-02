// projects array lives in projects-data.js (loaded before this script)

// ── Render project cards ──────────────────────────────────────────
function buildThumb(p) {
  if (p.model) {
    const t = p.modelOrbit ? p.modelOrbit.theta : 0;
    const ph = p.modelOrbit ? p.modelOrbit.phi   : 90;
    return `<model-viewer src="${p.model}" camera-orbit="${t}deg ${ph}deg auto" data-project-id="${p.id}" interaction-prompt="none" shadow-intensity="0" exposure="0.5" touch-action="pan-y" style="width:100%;height:100%;background:#0f110c;display:block;"></model-viewer>`;
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
    setTimeout(() => entry.target.classList.add('visible'), i * 80);
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
