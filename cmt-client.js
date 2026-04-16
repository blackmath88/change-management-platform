/**
 * cmt-client.js
 * Change Management Platform — Shared Supabase Client
 * ─────────────────────────────────────────────────────
 * Include in every HTML file with:
 *   <script src="cmt-client.js"></script>
 *
 * Then use the CMT object:
 *   await CMT.getProjects()
 *   await CMT.createProject({ title, organization, your_role, summary })
 *   await CMT.saveModule(projectId, 'vision', dataObject)
 *   await CMT.loadModule(projectId, 'vision')
 *   await CMT.getProject(projectId)
 *   await CMT.updateProject(projectId, { title, stage, ... })
 *   await CMT.deleteProject(projectId)
 */

const CMT = (() => {

  // ── CONFIG ──────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://rikjyomeaguntynhlqwb.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpa2p5b21lYWd1bnR5bmhscXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNTUzMTgsImV4cCI6MjA5MTYzMTMxOH0.Ly0fe9szBilaDt0uPYOT1EiFqfI7V7iStJAXCP8h7v8';

  const HEADERS = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'return=representation',
  };

  // ── SESSION TOKEN ────────────────────────────────────────────────
  // Anonymous identity — one UUID per browser, persisted in localStorage.
  // All projects created from this browser share this token.
  function getSessionToken() {
    let token = localStorage.getItem('cmt_session_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('cmt_session_token', token);
    }
    return token;
  }

  // ── CURRENT PROJECT ──────────────────────────────────────────────
  // Lightweight session memory — which project is currently open.
  function getCurrentProjectId() {
    return localStorage.getItem('cmt_current_project');
  }
  function setCurrentProjectId(id) {
    localStorage.setItem('cmt_current_project', id);
  }
  function clearCurrentProject() {
    localStorage.removeItem('cmt_current_project');
  }

  // ── LOCAL CACHE ──────────────────────────────────────────────────
  // Write-through cache so tools feel instant even on slow connections.
  function cacheModule(projectId, module, data) {
    localStorage.setItem(`cmt_module_${projectId}_${module}`, JSON.stringify(data));
  }
  function getCachedModule(projectId, module) {
    const raw = localStorage.getItem(`cmt_module_${projectId}_${module}`);
    return raw ? JSON.parse(raw) : null;
  }
  function clearProjectCache(projectId) {
    ['vision','forces','stakeholders','communication','nudges'].forEach(m => {
      localStorage.removeItem(`cmt_module_${projectId}_${m}`);
    });
  }

  // ── CORE FETCH ──────────────────────────────────────────────────
  async function query(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, { headers: HEADERS, ...options });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error ${res.status}: ${err}`);
    }
    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  // ── PROJECTS ────────────────────────────────────────────────────

  /** List all projects for this browser session, newest first */
  async function getProjects() {
    const token = getSessionToken();
    return query(
      `projects?session_token=eq.${token}&order=updated_at.desc&select=*`
    );
  }

  /** Get a single project by id */
  async function getProject(projectId) {
    const rows = await query(`projects?id=eq.${projectId}&select=*&limit=1`);
    return rows?.[0] ?? null;
  }

  /** Create a new project */
  async function createProject({ title = 'Untitled Project', organization = '', your_role = '', summary = '' } = {}) {
    const token = getSessionToken();
    const rows = await query('projects', {
      method: 'POST',
      body: JSON.stringify({
        session_token: token,
        title,
        organization,
        your_role,
        summary,
        stage: 'unit_1',
      }),
    });
    const project = rows?.[0];
    if (project) setCurrentProjectId(project.id);
    return project;
  }

  /** Update project metadata */
  async function updateProject(projectId, fields = {}) {
    const rows = await query(`projects?id=eq.${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    });
    return rows?.[0] ?? null;
  }

  /** Delete a project (cascades to change_modules) */
  async function deleteProject(projectId) {
    await query(`projects?id=eq.${projectId}`, { method: 'DELETE' });
    clearProjectCache(projectId);
    if (getCurrentProjectId() === projectId) clearCurrentProject();
  }

  // ── MODULES ─────────────────────────────────────────────────────

  /**
   * Save module data for a project.
   * Uses upsert — creates if not exists, updates if exists.
   * Also writes to local cache for instant reads.
   *
   * module: 'vision' | 'forces' | 'stakeholders' | 'communication' | 'nudges'
   * data:   plain JS object — will be stored as jsonb
   */
  async function saveModule(projectId, module, data) {
    // Write to cache immediately (optimistic)
    cacheModule(projectId, module, data);

    // Upsert to Supabase
    const rows = await query('change_modules', {
      method:  'POST',
      headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify({ project_id: projectId, module, data }),
    });

    // Advance project stage if needed
    await advanceStage(projectId, module);

    return rows?.[0] ?? null;
  }

  /**
   * Load module data for a project.
   * Returns cached version immediately if available,
   * then fetches from Supabase in background.
   */
  async function loadModule(projectId, module) {
    // Return cache first for instant UX
    const cached = getCachedModule(projectId, module);

    // Fetch fresh from Supabase
    try {
      const rows = await query(
        `change_modules?project_id=eq.${projectId}&module=eq.${module}&select=data&limit=1`
      );
      const fresh = rows?.[0]?.data ?? null;
      if (fresh) cacheModule(projectId, module, fresh);
      return fresh ?? cached ?? null;
    } catch (e) {
      console.warn('CMT: loadModule fell back to cache', e);
      return cached;
    }
  }

  /**
   * Load all modules for a project in one query.
   * Returns { vision, forces, stakeholders, communication, nudges }
   */
  async function loadAllModules(projectId) {
    const rows = await query(
      `change_modules?project_id=eq.${projectId}&select=module,data`
    );
    const result = {};
    (rows ?? []).forEach(r => {
      result[r.module] = r.data;
      cacheModule(projectId, r.module, r.data);
    });
    return result;
  }

  // ── STAGE PROGRESSION ────────────────────────────────────────────
  // Automatically advance the project stage as modules are saved.
  const STAGE_ORDER = ['unit_1','unit_2','unit_3','unit_4','unit_5','complete'];
  const MODULE_TO_STAGE = {
    vision:        'unit_1',
    forces:        'unit_2',
    stakeholders:  'unit_3',
    communication: 'unit_4',
    nudges:        'unit_5',
  };

  async function advanceStage(projectId, module) {
    try {
      const project = await getProject(projectId);
      if (!project) return;
      const moduleStage = MODULE_TO_STAGE[module];
      const currentIdx = STAGE_ORDER.indexOf(project.stage);
      const moduleIdx  = STAGE_ORDER.indexOf(moduleStage);
      // Advance if this module is ahead of current stage
      if (moduleIdx >= currentIdx) {
        const nextStage = STAGE_ORDER[Math.min(moduleIdx + 1, STAGE_ORDER.length - 1)];
        await updateProject(projectId, { stage: nextStage });
      }
    } catch (e) {
      // Non-critical — don't throw
      console.warn('CMT: advanceStage failed silently', e);
    }
  }

  // ── EXPORT / IMPORT ──────────────────────────────────────────────

  /** Export a full project as a downloadable JSON file */
  async function exportProject(projectId) {
    const [project, modules] = await Promise.all([
      getProject(projectId),
      loadAllModules(projectId),
    ]);
    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        schema_version: '1.0',
        source: 'Change Management Platform',
      },
      project,
      modules,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${(project?.title || 'project').replace(/\s+/g,'-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Import a project from a JSON file (File object) */
  async function importProject(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const payload = JSON.parse(e.target.result);
          const { project, modules } = payload;
          // Create new project
          const created = await createProject({
            title:        project.title,
            organization: project.organization,
            your_role:    project.your_role,
            summary:      project.summary,
          });
          // Save each module
          for (const [module, data] of Object.entries(modules || {})) {
            if (data) await saveModule(created.id, module, data);
          }
          resolve(created);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // ── HEALTH CHECK ─────────────────────────────────────────────────
  async function ping() {
    try {
      await query('projects?limit=1&select=id');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── PUBLIC API ───────────────────────────────────────────────────
  return {
    // Session
    getSessionToken,
    getCurrentProjectId,
    setCurrentProjectId,
    clearCurrentProject,

    // Projects
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,

    // Modules
    saveModule,
    loadModule,
    loadAllModules,

    // Export / Import
    exportProject,
    importProject,

    // Utils
    ping,
  };

})();
