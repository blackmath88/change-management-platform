/**
 * cmt-client.js
 * Change Management Platform — Supabase Client v2
 * ─────────────────────────────────────────────────
 * Include in every HTML file:
 *   <script src="cmt-client.js"></script>
 *
 * Supabase is the primary persistence layer.
 * localStorage is a write-through cache for instant reads.
 *
 * Public API:
 *   await CMT.getProjects()
 *   await CMT.getProject(id)
 *   await CMT.createProject({ title, organization, your_role, summary })
 *   await CMT.updateProject(id, fields)
 *   await CMT.deleteProject(id)
 *   await CMT.saveModule(projectId, module, data)
 *   await CMT.loadModule(projectId, module)
 *   await CMT.loadAllModules(projectId)
 *   await CMT.exportProject(projectId)
 *   await CMT.importProject(file)
 *   await CMT.ping()
 *   CMT.getSessionToken()
 *   CMT.getCurrentProjectId()
 *   CMT.setCurrentProjectId(id)
 */

const CMT = (() => {

  // ── CONFIG ────────────────────────────────────────────────
  const SB_URL = 'https://rikjyomeaguntynhlqwb.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa2p5b21lYWd1bnR5bmhscXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNTUzMTgsImV4cCI6MjA5MTYzMTMxOH0.Ly0fe9szBilaDt0uPYOT1EiFqfI7V7iStJAXCP8h7v8';

  const BASE_HEADERS = {
    'Content-Type':  'application/json',
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Prefer':        'return=representation',
  };

  // ── SESSION TOKEN ─────────────────────────────────────────
  function getSessionToken() {
    let t = localStorage.getItem('cmt_session_token');
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem('cmt_session_token', t);
    }
    return t;
  }

  // ── CURRENT PROJECT ───────────────────────────────────────
  function getCurrentProjectId() {
    return localStorage.getItem('cmt_current_project');
  }
  function setCurrentProjectId(id) {
    if (id) localStorage.setItem('cmt_current_project', id);
    else localStorage.removeItem('cmt_current_project');
  }

  // ── LOCAL CACHE ───────────────────────────────────────────
  function cacheSet(projectId, module, data) {
    try { localStorage.setItem(`cmt_module_${projectId}_${module}`, JSON.stringify(data)); }
    catch(e) {}
  }
  function cacheGet(projectId, module) {
    try {
      const raw = localStorage.getItem(`cmt_module_${projectId}_${module}`);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }
  function cacheClear(projectId) {
    ['vision','forces','stakeholders','communication','nudges'].forEach(m => {
      localStorage.removeItem(`cmt_module_${projectId}_${m}`);
    });
  }

  // ── CORE FETCH ────────────────────────────────────────────
  async function req(path, options = {}) {
    const { headers: extraHeaders, ...rest } = options;
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { ...BASE_HEADERS, ...(extraHeaders || {}) },
      ...rest,
    });
    if (res.status === 204) return null;
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
    return body;
  }

  // ── PROJECTS ──────────────────────────────────────────────

  async function getProjects() {
    const token = getSessionToken();
    const rows = await req(
      `projects?session_token=eq.${encodeURIComponent(token)}&order=updated_at.desc&select=*`
    );
    return rows || [];
  }

  async function getProject(id) {
    const rows = await req(`projects?id=eq.${id}&select=*&limit=1`);
    return rows?.[0] ?? null;
  }

  async function createProject({ title = 'Untitled Project', organization = '', your_role = '', summary = '' } = {}) {
    const token = getSessionToken();
    const rows = await req('projects', {
      method: 'POST',
      body: JSON.stringify({ session_token: token, title, organization, your_role, summary, stage: 'unit_1' }),
    });
    const project = rows?.[0];
    if (project) setCurrentProjectId(project.id);
    return project;
  }

  async function updateProject(id, fields = {}) {
    const rows = await req(`projects?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return rows?.[0] ?? null;
  }

  async function deleteProject(id) {
    await req(`projects?id=eq.${id}`, { method: 'DELETE' });
    cacheClear(id);
    if (getCurrentProjectId() === id) setCurrentProjectId(null);
  }

  // ── MODULES ───────────────────────────────────────────────

  async function saveModule(projectId, module, data) {
    cacheSet(projectId, module, data);
    const rows = await req('change_modules', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ project_id: projectId, module, data }),
    });
    _advanceStage(projectId, module).catch(() => {});
    return rows?.[0] ?? null;
  }

  async function loadModule(projectId, module) {
    const cached = cacheGet(projectId, module);
    try {
      const rows = await req(
        `change_modules?project_id=eq.${projectId}&module=eq.${module}&select=data&limit=1`
      );
      const fresh = rows?.[0]?.data ?? null;
      if (fresh) cacheSet(projectId, module, fresh);
      return fresh ?? cached ?? null;
    } catch(e) {
      console.warn('CMT: loadModule fell back to cache', e.message);
      return cached;
    }
  }

  async function loadAllModules(projectId) {
    const rows = await req(`change_modules?project_id=eq.${projectId}&select=module,data`);
    const result = {};
    (rows ?? []).forEach(r => {
      result[r.module] = r.data;
      cacheSet(projectId, r.module, r.data);
    });
    return result;
  }

  // ── STAGE PROGRESSION ─────────────────────────────────────
  const STAGE_ORDER  = ['unit_1','unit_2','unit_3','unit_4','unit_5','complete'];
  const MODULE_STAGE = { vision:'unit_1', forces:'unit_2', stakeholders:'unit_3', communication:'unit_4', nudges:'unit_5' };

  async function _advanceStage(projectId, module) {
    try {
      const project    = await getProject(projectId);
      if (!project) return;
      const moduleIdx  = STAGE_ORDER.indexOf(MODULE_STAGE[module]);
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      if (moduleIdx >= currentIdx) {
        const next = STAGE_ORDER[Math.min(moduleIdx + 1, STAGE_ORDER.length - 1)];
        await updateProject(projectId, { stage: next });
      }
    } catch(e) {}
  }

  // ── EXPORT / IMPORT ───────────────────────────────────────

  async function exportProject(projectId) {
    const [project, modules] = await Promise.all([
      getProject(projectId),
      loadAllModules(projectId),
    ]);
    const payload = {
      meta: { exported_at: new Date().toISOString(), schema_version: '1.0', source: 'Change Management Platform' },
      project,
      modules,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${(project?.title || 'project').replace(/\s+/g,'-').toLowerCase()}.json`;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  }

  async function importProject(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const { project, modules } = JSON.parse(e.target.result);
          const created = await createProject({
            title:        project?.title        || 'Imported Project',
            organization: project?.organization || '',
            your_role:    project?.your_role    || '',
            summary:      project?.summary      || '',
          });
          for (const [mod, data] of Object.entries(modules || {})) {
            if (data) await saveModule(created.id, mod, data);
          }
          resolve(created);
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ── HEALTH ────────────────────────────────────────────────

  async function ping() {
    try {
      await req('projects?limit=1&select=id');
      return { ok: true };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }

  // ── PUBLIC API ────────────────────────────────────────────
  return {
    getSessionToken, getCurrentProjectId, setCurrentProjectId,
    getProjects, getProject, createProject, updateProject, deleteProject,
    saveModule, loadModule, loadAllModules,
    exportProject, importProject,
    ping,
  };

})();
