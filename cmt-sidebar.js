'use strict';
/* ================================================================
   cmt-sidebar.js — workspace navigator
   Renders into #cmt-sidebar-mount. No <nav> tags (avoids the global
   tag-selector collision that broke the previous build).
   All styles live in cmt-shell.css.
   ================================================================ */

(function () {

  const UNITS = [
    { id:'vision',        num:'01', name:'Change Vision',  file:'unit1-vision.html',        accent:'var(--u1)' },
    { id:'forces',        num:'02', name:'Force Field',    file:'unit2-forces.html',        accent:'var(--u2)' },
    { id:'stakeholders',  num:'03', name:'Stakeholders',   file:'unit3-stakeholders.html',  accent:'var(--u3)' },
    { id:'communication', num:'04', name:'Communication',  file:'unit4-communication.html', accent:'var(--u4)' },
    { id:'nudges',        num:'05', name:'Momentum',       file:'unit5-nudges.html',        accent:'var(--u5)' },
  ];

  const PAGE_UNIT = {
    'unit1-vision.html':        'vision',
    'unit2-forces.html':        'forces',
    'unit3-stakeholders.html':  'stakeholders',
    'unit4-communication.html': 'communication',
    'unit5-nudges.html':        'nudges',
  };

  function pid() {
    return new URLSearchParams(window.location.search).get('project')
      || localStorage.getItem('cmt_current_project') || '';
  }

  function currentUnit() {
    return PAGE_UNIT[location.pathname.split('/').pop()] || '';
  }

  function getProject(id) {
    return (JSON.parse(localStorage.getItem('cmt_projects') || '[]')).find(p => p.id === id) || null;
  }

  function getNorthStar(id) {
    try { return JSON.parse(localStorage.getItem('cmt_module_' + id + '_vision') || '{}').north_star || ''; }
    catch (e) { return ''; }
  }

  function hasData(id, module) {
    try {
      const d = JSON.parse(localStorage.getItem('cmt_module_' + id + '_' + module) || 'null');
      if (!d) return false;
      return Object.values(d).some(function (v) {
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === 'object') return Object.values(v).some(function (x) { return x && String(x).trim(); });
        return false;
      });
    } catch (e) { return false; }
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render() {
    const mount = document.getElementById('cmt-sidebar-mount');
    if (!mount) return;

    const projectId = pid();
    const active    = currentUnit();
    const project   = projectId ? getProject(projectId) : null;
    const northStar = projectId ? getNorthStar(projectId) : '';

    const homeStrip =
      '<div class="csb-home-strip">'
      +   '<a class="csb-home" href="index.html">'
      +     '<span class="csb-home-arrow">←</span>'
      +     '<span>All projects</span>'
      +   '</a>'
      + '</div>';

    const projBlock = project
      ? '<div class="csb-project-block">'
        +   '<div class="csb-project-label">Project</div>'
        +   '<div class="csb-project-title" title="' + esc(project.title) + '">' + esc(project.title) + '</div>'
        +   (project.organization ? '<div class="csb-project-org">' + esc(project.organization) + '</div>' : '')
        + '</div>'
      : '<div class="csb-project-block">'
        +   '<div class="csb-project-label">Project</div>'
        +   '<div class="csb-project-title" style="color:var(--muted);font-style:italic;">No project selected</div>'
        + '</div>';

    const nsBlock = northStar
      ? '<div class="csb-ns">'
        +   '<div class="csb-ns-label">North star</div>'
        +   '<div class="csb-ns-text">' + esc(northStar) + '</div>'
        + '</div>'
      : '';

    const items = UNITS.map(u => {
      const isActive = u.id === active;
      const hasDat   = projectId ? hasData(projectId, u.id) : false;
      const href     = projectId ? u.file + '?project=' + encodeURIComponent(projectId) : u.file;
      const classes  = 'csb-item' + (isActive ? ' is-active' : '') + (hasDat ? ' has-data' : '');
      return '<a class="' + classes + '" href="' + href + '" style="--csb-accent:' + u.accent + ';">'
        +   '<span class="csb-num">' + u.num + '</span>'
        +   '<span class="csb-label">' + u.name + '</span>'
        +   '<span class="csb-dot"></span>'
        + '</a>';
    }).join('');

    const navBlock =
      '<div class="csb-section-label">Workspace</div>'
      + '<div class="csb-nav-list">' + items + '</div>';

    mount.innerHTML =
      '<aside class="cmt-sb">'
      +   homeStrip
      +   projBlock
      +   nsBlock
      +   navBlock
      + '</aside>';

    const titleEl = document.getElementById('topbar-project');
    const orgEl   = document.getElementById('topbar-org');
    if (titleEl && project) titleEl.textContent = project.title || '';
    if (orgEl && project)   orgEl.textContent   = project.organization || '';
  }

  window.CMTSidebar = { init: render, refresh: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

})();
