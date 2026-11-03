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

  // Optional demo videos; preload="none" so nothing downloads until you press play
  const videosHtml = !p.videos ? '' : `
      <div class="proj-panel">
        <p class="panel-label">Demos</p>
        <div class="dd-videos">${p.videos.map(v => `
          <figure class="dd-video${v.portrait ? ' portrait' : ''}">
            <video controls playsinline preload="none" poster="${v.poster}">
              <source src="${v.src}" type="video/mp4" />
            </video>
            <figcaption>${v.title}</figcaption>
          </figure>`).join('')}
        </div>
      </div>`;

  // Optional build photos; each opens full size in a new tab
  const photosHtml = !p.photos ? '' : `
      <div class="proj-panel">
        <p class="panel-label">Photos</p>
        <div class="dd-photos">${p.photos.map(ph => `
          <a href="${ph.src}" target="_blank" rel="noopener"><img src="${ph.src}" alt="${ph.alt}" loading="lazy" /></a>`).join('')}
        </div>
      </div>`;

  // Optional deep dive: specs at a glance, a schematic walkthrough, and layout notes with the stackup
  const dd = p.deepDive;
  // board image views (files in dd.layout.boards); stackup rows map top-to-bottom onto the copper views
  const copperViews = ['cu-top', 'cu-inner1', 'cu-inner2', 'cu-bottom'];
  const boardViews = [['top', 'Top'], ['bottom', 'Bottom'], ['cu-top', 'Top copper'], ['cu-inner1', 'Inner 1'], ['cu-inner2', 'Inner 2'], ['cu-bottom', 'Bottom copper']];
  const blocksHtml = blocks => `<div class="dd-blocks">${blocks.map(b => `
        <div class="dd-block">
          <h3 class="dd-title">${b.title}</h3>
          <p class="dd-body">${b.body}</p>
          ${b.parts ? `<p class="dd-parts">${b.parts}</p>` : ''}
        </div>`).join('')}</div>`;
  const deepDiveHtml = !dd ? '' : `
      <div class="proj-panel">
        <p class="panel-label">At a Glance</p>
        <dl class="dd-specs">${dd.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div>
      <div class="proj-panel">
        <p class="panel-label">Schematic</p>
        <p class="proj-desc">${dd.schematic.intro}</p>
        ${blocksHtml(dd.schematic.blocks)}
      </div>
      <div class="proj-panel">
        <p class="panel-label">Layout</p>
        <p class="proj-desc">${dd.layout.intro}</p>
        ${dd.layout.boards ? `
        <div class="dd-board">
          <div class="dd-board-tabs" role="tablist">
            ${boardViews.map(([key, label], i) => `<button role="tab" data-view="${key}" aria-selected="${i === 0}">${label}</button>`).join('')}
          </div>
          <div class="dd-board-view">
            <img src="${dd.layout.boards}top.webp" alt="Rendered top of the ${p.title} board" />
          </div>
          <p class="dd-board-note">Rendered from the fabrication Gerbers. Copper layers are shown from above, so they line up.</p>
        </div>` : ''}
        <div class="dd-stack" aria-label="Layer stackup">
          ${dd.layout.stackup.map(([name, role, cu], i) => `
          <div class="dd-layer${/2 oz/.test(cu) ? ' heavy' : /½/.test(cu) ? ' light' : ''}"${dd.layout.boards ? ` role="button" tabindex="0" data-view="${copperViews[i]}"` : ''}>
            <span class="dd-layer-name">${name}</span>
            <span class="dd-layer-bar"></span>
            <span class="dd-layer-role">${role}</span>
            <span class="dd-layer-cu">${cu}</span>
          </div>`).join('<div class="dd-diel"></div>')}
        </div>
        ${blocksHtml(dd.layout.blocks)}
      </div>`;

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
      </div>${videosHtml}${photosHtml}${deepDiveHtml}
      <div class="proj-panel">
        <p class="panel-label">Tags</p>
        <div class="proj-tags">${tagsHtml}</div>
      </div>
    </div>`;

  // board viewer: tabs and stackup rows both switch the image
  const boardImg = content.querySelector('.dd-board-view img');
  if (boardImg) {
    const tabs = [...content.querySelectorAll('.dd-board-tabs button')];
    const rows = [...content.querySelectorAll('.dd-layer[data-view]')];
    const labels = Object.fromEntries(boardViews);
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let currentView = 'top', flipping = false, queued = null;
    const swap = view => {
      boardImg.src = `${dd.layout.boards}${view}.webp`;
      boardImg.alt = `${labels[view]} of the ${p.title} board`;
    };
    const showView = async view => {
      if (flipping) { queued = view; return; } // mid-flip: show the latest choice once it finishes
      if (view === currentView) return;
      tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.view === view));
      rows.forEach(r => r.classList.toggle('active', r.dataset.view === view));
      const turnOver = ['top', 'bottom'].includes(view) && ['top', 'bottom'].includes(currentView);
      currentView = view;
      if (!turnOver || reduceMotion) return swap(view);
      // turn the board over around its vertical axis: rotate to edge-on, swap sides, rotate back in
      flipping = true;
      const ease = { duration: 220, fill: 'forwards' };
      await boardImg.animate([{ transform: 'perspective(1200px) rotateY(0deg)' }, { transform: 'perspective(1200px) rotateY(90deg)' }], { ...ease, easing: 'ease-in' }).finished;
      swap(view);
      await boardImg.decode().catch(() => {});
      await boardImg.animate([{ transform: 'perspective(1200px) rotateY(-90deg)' }, { transform: 'perspective(1200px) rotateY(0deg)' }], { ...ease, easing: 'ease-out' }).finished;
      flipping = false;
      if (queued) { const next = queued; queued = null; showView(next); }
    };
    tabs.forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
    rows.forEach(r => {
      r.addEventListener('click', () => {
        showView(r.dataset.view);
        boardImg.closest('.dd-board').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); r.click(); } });
    });
    // warm the cache so switching views is instant
    addEventListener('load', () => boardViews.forEach(([v]) => { new Image().src = `${dd.layout.boards}${v}.webp`; }));
  }

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
