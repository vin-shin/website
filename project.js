const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const p = projects.find(x => x.id === id);

const content = document.getElementById('project-content');

if (!p) {
  content.innerHTML = `
    <div class="proj-not-found">
      <p>Project not found.</p>
      <a href="index.html" class="btn btn-primary" style="margin-top:1rem;display:inline-block;">Back to Portfolio</a>
    </div>`;
} else {
  document.title = `${p.title} – Vin Shin`;

  const initTheta  = p.modelOrbit ? p.modelOrbit.theta  : 0;
  const initPhi    = p.modelOrbit ? p.modelOrbit.phi    : 90;
  const initRadius = p.modelOrbit && p.modelOrbit.radius ? p.modelOrbit.radius : 'auto';
  const thumbOverlay = p.thumb
    ? `<img src="${p.thumb}" aria-hidden="true" class="proj-thumb-overlay" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;transition:opacity 0.6s ease;z-index:1;" />`
    : '';
  const heroInner = p.model
    ? `${thumbOverlay}<model-viewer src="${p.model}" camera-orbit="${initTheta}deg ${initPhi}deg ${initRadius}" interaction-prompt="none" shadow-intensity="0.4" exposure="0.5" touch-action="pan-y" style="width:100%;height:100%;background:transparent;display:block;"></model-viewer>`
    : p.image
      ? `<img src="${p.image}" alt="${p.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
      : `<div class="proj-hero-icon">${p.icon}</div>`;

  const bulletsHtml = p.bullets.map(b => `<li>${b}</li>`).join('');
  const tagsHtml = p.tags.map(t => `<span class="tag">${t}</span>`).join('');

  content.innerHTML = `
    <div class="proj-hero" style="background:${p.gradient};">
      ${heroInner}
      <div class="proj-hero-overlay"></div>
      <div class="proj-hero-meta">
        <span class="proj-context">${p.context}</span>
        <h1 class="proj-title">${p.title}</h1>
        <span class="proj-date">${p.date}</span>
      </div>
    </div>

    <div class="proj-body" id="proj-body">
      <div class="proj-panel">
        <p class="panel-label">Overview</p>
        <p class="proj-desc">${p.description}</p>
        <ul class="proj-bullets">${bulletsHtml}</ul>
      </div>
      <div class="proj-panel">
        <p class="panel-label">Tags</p>
        <div class="proj-tags">${tagsHtml}</div>
      </div>
    </div>`;

  const mv = content.querySelector('model-viewer');
  if (mv) {
    const REST_PHI    = p.modelOrbit ? p.modelOrbit.phi : 90;
    const REST_RADIUS = p.modelOrbit && p.modelOrbit.radius ? p.modelOrbit.radius : 'auto';
    let theta = p.modelOrbit ? p.modelOrbit.theta : 0;
    let hovered = false;

    function physTick() {
      if (!hovered) theta += 0.15;
      mv.setAttribute('camera-orbit', `${theta}deg ${REST_PHI}deg ${REST_RADIUS}`);
      requestAnimationFrame(physTick);
    }

    mv.addEventListener('load', () => {
      const overlay = content.querySelector('.proj-thumb-overlay');
      if (overlay) overlay.style.opacity = '0';
      requestAnimationFrame(physTick);
    });
    mv.addEventListener('mouseenter', () => { hovered = true; });
    mv.addEventListener('mouseleave', () => { hovered = false; });
  }
}
