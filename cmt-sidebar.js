'use strict';

(function () {

  const UNITS = [
    { id:'vision',        num:'01', name:'Change Vision',  file:'unit1-vision.html',        color:'#1a56db', lt:'#e8eefb' },
    { id:'forces',        num:'02', name:'Force Field',    file:'unit2-forces.html',        color:'#b45309', lt:'#fef3c7' },
    { id:'stakeholders',  num:'03', name:'Stakeholders',   file:'unit3-stakeholders.html',  color:'#7c3aed', lt:'#ede9fe' },
    { id:'communication', num:'04', name:'Communication',  file:'unit4-communication.html', color:'#0e7490', lt:'#e0f2fe' },
    { id:'nudges',        num:'05', name:'Momentum',       file:'unit5-nudges.html',        color:'#1a7a3a', lt:'#e4f4ea' },
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

  function injectCSS() {
    if (document.getElementById('_cmtsb_css')) return;
    var s = document.createElement('style');
    s.id = '_cmtsb_css';
    s.textContent = [
      /* ── App shell layout ── */
      '.app-layout{flex:1;display:flex;min-height:0;overflow:hidden;}',
      '.unit-main{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;}',

      /* ── Project strip ── */
      '.project-strip{flex-shrink:0;height:38px;background:#fff;border-bottom:1px solid #dde3f0;display:flex;align-items:center;padding:0 1.25rem;overflow:hidden;}',
      '#cmt-strip-inner{display:flex;align-items:center;gap:0;overflow:hidden;white-space:nowrap;flex:1;min-width:0;}',
      '.ps-title{font-size:0.78rem;font-weight:700;color:#0d2d6e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;}',
      '.ps-sep{color:#c8d4ea;margin:0 0.55rem;flex-shrink:0;}',
      '.ps-org{font-size:0.74rem;color:#7a8aaa;white-space:nowrap;flex-shrink:0;}',
      '.ps-ns{font-size:0.72rem;color:#7a8aaa;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;}',

      /* ── Platform sidebar ── */
      '.cmt-sb{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #dde3f0;display:flex;flex-direction:column;overflow:hidden;height:100%;}',
      '.csb-top{padding:1rem 1rem 0.85rem;border-bottom:1px solid #dde3f0;}',
      '.csb-home{display:flex;align-items:center;gap:0.5rem;text-decoration:none;margin-bottom:0.85rem;opacity:0.5;transition:opacity 0.15s;}',
      '.csb-home:hover{opacity:1;}',
      '.csb-logo{width:20px;height:20px;background:#0d2d6e;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:"IBM Plex Mono",monospace;font-size:0.55rem;font-weight:800;color:#fff;letter-spacing:-0.05em;flex-shrink:0;}',
      '.csb-home-lbl{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;font-weight:600;color:#0d2d6e;letter-spacing:0.06em;text-transform:uppercase;}',
      '.csb-proj{font-size:0.8rem;font-weight:700;color:#0f1623;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:0.15rem;}',
      '.csb-org{font-size:0.7rem;color:#7a8aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.csb-ns-area{padding:0.6rem 1rem;border-bottom:1px solid #dde3f0;background:#f4f6fb;}',
      '.csb-ns-lbl{font-family:"IBM Plex Mono",monospace;font-size:0.55rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#1a56db;margin-bottom:0.2rem;}',
      '.csb-ns-txt{font-size:0.72rem;font-weight:500;color:#0f1623;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.csb-section-lbl{padding:0.65rem 1rem 0.3rem;font-family:"IBM Plex Mono",monospace;font-size:0.55rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7a8aaa;}',
      '.csb-nav{flex:1;overflow-y:auto;}',
      '.csb-nav::-webkit-scrollbar{display:none;}',
      '.csb-item{display:flex;align-items:center;gap:0.55rem;padding:0.6rem 1rem;text-decoration:none;color:#3a4460;transition:background 0.12s;position:relative;}',
      '.csb-item:hover{background:#eef1f8;}',
      '.csb-item.csb-active{background:var(--csbal,#e8eefb);}',
      '.csb-item.csb-active::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--csbac,#1a56db);border-radius:0 2px 2px 0;}',
      '.csb-badge{width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:"IBM Plex Mono",monospace;font-size:0.6rem;font-weight:700;flex-shrink:0;}',
      '.csb-name{flex:1;min-width:0;font-size:0.76rem;font-weight:600;color:#0f1623;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.csb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}',
    ].join('');
    document.head.appendChild(s);
  }

  function render() {
    injectCSS();

    var projectId  = pid();
    var active     = currentUnit();
    var project    = projectId ? getProject(projectId) : null;
    var northStar  = projectId ? getNorthStar(projectId) : '';

    /* ── Sidebar ── */
    var mount = document.getElementById('cmt-sidebar-mount');
    if (mount) {
      var navItems = UNITS.map(function (u) {
        var isActive = u.id === active;
        var hasDat   = projectId ? hasData(projectId, u.id) : false;
        var href     = projectId ? u.file + '?project=' + encodeURIComponent(projectId) : u.file;
        var style    = isActive ? 'style="--csbac:' + u.color + ';--csbal:' + u.lt + '"' : '';
        return '<a class="csb-item' + (isActive ? ' csb-active' : '') + '" href="' + href + '" ' + style + '>'
          + '<span class="csb-badge" style="background:' + (isActive ? u.color : u.lt) + ';color:' + (isActive ? '#fff' : u.color) + '">' + u.num + '</span>'
          + '<span class="csb-name">' + u.name + '</span>'
          + '<span class="csb-dot" style="background:' + (hasDat ? u.color : '#dde3f0') + '"></span>'
          + '</a>';
      }).join('');

      var projBlock = project
        ? '<div class="csb-proj" title="' + esc(project.title) + '">' + esc(project.title) + '</div>'
          + (project.organization ? '<div class="csb-org">' + esc(project.organization) + '</div>' : '')
        : '';

      var nsBlock = northStar
        ? '<div class="csb-ns-area"><div class="csb-ns-lbl">North star</div><div class="csb-ns-txt">' + esc(northStar) + '</div></div>'
        : '';

      mount.innerHTML = '<aside class="cmt-sb">'
        + '<div class="csb-top">'
        + '<a href="index.html" class="csb-home">'
        + '<span class="csb-logo">CM</span>'
        + '<span class="csb-home-lbl">Projects</span>'
        + '</a>'
        + projBlock
        + '</div>'
        + nsBlock
        + '<div class="csb-section-lbl">Workspace</div>'
        + '<nav class="csb-nav">' + navItems + '</nav>'
        + '</aside>';
    }

    /* ── Project strip ── */
    var strip = document.getElementById('cmt-strip-inner');
    if (strip) {
      if (project) {
        var html = '<span class="ps-title">' + esc(project.title) + '</span>';
        if (project.organization) {
          html += '<span class="ps-sep">·</span><span class="ps-org">' + esc(project.organization) + '</span>';
        }
        if (northStar) {
          html += '<span class="ps-sep">·</span><span class="ps-ns">' + esc(northStar) + '</span>';
        }
        strip.innerHTML = html;
      } else {
        strip.innerHTML = '<span class="ps-title" style="opacity:0.3;font-weight:400">No project selected</span>';
      }
    }
  }

  window.CMTSidebar = { init: render, refresh: render };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

})();
