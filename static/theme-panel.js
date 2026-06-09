/**
 * theme-panel.js  v2
 * Right-side design control panel with 3-slot theme save/load.
 * Themes persist across page refreshes via localStorage.
 * Add before </body>:  <script src="/static/theme-panel.js"></script>
 */

(function () {
  'use strict';

  const LS_ACTIVE = 'tp_active_theme';   // key storing which slot is active
  const LS_SLOT   = (n) => `tp_theme_${n}`; // keys for slot data

  /* ─────────────────────────────────────────
     1. DESIGN TOKENS
  ───────────────────────────────────────── */
  const TOKENS = [
    { group:'Colors', id:'--bg',           label:'Background',        type:'color', def:'#0a0c0b' },
    { group:'Colors', id:'--panel',        label:'Panel',             type:'color', def:'#121614' },
    { group:'Colors', id:'--panel-2',      label:'Panel (inner)',      type:'color', def:'#161b19' },
    { group:'Colors', id:'--line',         label:'Borders / Lines',    type:'color', def:'#232b28' },
    { group:'Colors', id:'--txt',          label:'Text',               type:'color', def:'#e8efe9' },
    { group:'Colors', id:'--muted',        label:'Muted text',         type:'color', def:'#8a978f' },
    { group:'Colors', id:'--accent',       label:'Accent (green)',     type:'color', def:'#34d399' },
    { group:'Colors', id:'--accent-dim',   label:'Accent dim',         type:'color', def:'#0f3d2e' },
    { group:'Colors', id:'--loss',         label:'Loss / red',         type:'color', def:'#f87171' },
    { group:'Colors', id:'--gold',         label:'Gold / highlight',   type:'color', def:'#e2b659' },

    { group:'Layout', id:'--tp-max-width', label:'Max container width',type:'px', min:600,  max:1600, def:1080 },
    { group:'Layout', id:'--tp-body-pad',  label:'Body padding',       type:'px', min:0,    max:80,   def:28   },
    { group:'Layout', id:'--tp-hero-gap',  label:'Hero column gap',    type:'px', min:0,    max:40,   def:12   },
    { group:'Layout', id:'--tp-stat-gap',  label:'Stat card gap',      type:'px', min:0,    max:40,   def:12   },

    { group:'Cards', id:'--tp-card-radius', label:'Card border radius', type:'px', min:0, max:40, def:16 },
    { group:'Cards', id:'--tp-stat-radius', label:'Stat card radius',   type:'px', min:0, max:40, def:14 },
    { group:'Cards', id:'--tp-stat-pad-v',  label:'Stat padding (v)',   type:'px', min:0, max:40, def:12 },
    { group:'Cards', id:'--tp-stat-pad-h',  label:'Stat padding (h)',   type:'px', min:0, max:40, def:16 },
    { group:'Cards', id:'--tp-chart-pad-v', label:'Chart pad (v)',      type:'px', min:0, max:40, def:14 },
    { group:'Cards', id:'--tp-chart-pad-h', label:'Chart pad (h)',      type:'px', min:0, max:40, def:18 },
    { group:'Cards', id:'--tp-chart-min-h', label:'Chart min-height',   type:'px', min:100, max:800, def:260 },

    { group:'Typography', id:'--tp-eyebrow-size',   label:'Eyebrow font size', type:'px', min:8,  max:24, def:12 },
    { group:'Typography', id:'--tp-stat-key-size',  label:'Stat label size',   type:'px', min:8,  max:20, def:11 },
    { group:'Typography', id:'--tp-stat-val-size',  label:'Stat value size',   type:'px', min:10, max:36, def:18 },
    { group:'Typography', id:'--tp-live-val-size',  label:'Live price size',   type:'px', min:14, max:48, def:24 },
    { group:'Typography', id:'--tp-live-date-size', label:'Live date size',    type:'px', min:10, max:24, def:14 },

    { group:'Alignment', id:'--tp-header-align',  label:'Header text-align', type:'select',
      options:['center','left','right'], def:'center' },
    { group:'Alignment', id:'--tp-livebar-align', label:'Live-bar justify',  type:'select',
      options:['space-between','flex-start','center','flex-end'], def:'space-between' },
    { group:'Alignment', id:'--tp-stat-key-tt',   label:'Stat label case',   type:'select',
      options:['uppercase','lowercase','capitalize','none'], def:'uppercase' },
  ];

  /* ─────────────────────────────────────────
     2. CSS VARIABLE HELPERS
  ───────────────────────────────────────── */
  const root = document.documentElement;
  const applyVar = (id, val) => root.style.setProperty(id, val);

  /* ─────────────────────────────────────────
     3. CSS OVERRIDES  (map tokens → selectors)
  ───────────────────────────────────────── */
  const overrideStyle = document.createElement('style');
  overrideStyle.textContent = `
    .wrap            { max-width: var(--tp-max-width,1080px) !important; }
    body             { padding: var(--tp-body-pad,28px) var(--tp-body-pad,20px) 60px !important; }
    .hero            { gap: var(--tp-hero-gap,12px) !important; }
    .summary,.statrow4 { gap: var(--tp-stat-gap,12px) !important; }
    .card,.chartcard { border-radius: var(--tp-card-radius,16px) !important; }
    .stat            { border-radius: var(--tp-stat-radius,14px) !important;
                       padding: var(--tp-stat-pad-v,12px) var(--tp-stat-pad-h,16px) !important; }
    .chartcard       { padding: var(--tp-chart-pad-v,14px) var(--tp-chart-pad-h,18px) var(--tp-chart-pad-v,10px) !important; }
    .chart-holder    { min-height: var(--tp-chart-min-h,260px) !important; }
    .eyebrow         { font-size: var(--tp-eyebrow-size,12px) !important; }
    .stat .k         { font-size: var(--tp-stat-key-size,11px) !important;
                       text-transform: var(--tp-stat-key-tt,uppercase) !important; }
    .stat .v         { font-size: var(--tp-stat-val-size,18px) !important; }
    .liveval         { font-size: var(--tp-live-val-size,24px) !important; }
    .livedate        { font-size: var(--tp-live-date-size,14px) !important; }
    header           { text-align: var(--tp-header-align,center) !important; }
    .livebar         { justify-content: var(--tp-livebar-align,space-between) !important; }
  `;
  document.head.appendChild(overrideStyle);

  /* ─────────────────────────────────────────
     4. THEME STORAGE  (3 named slots)
  ───────────────────────────────────────── */
  function captureTheme(name) {
    const vals = {};
    TOKENS.forEach(tok => {
      vals[tok.id] = root.style.getPropertyValue(tok.id) ||
                     getComputedStyle(root).getPropertyValue(tok.id).trim();
    });
    return { name, vals, ts: Date.now() };
  }

  function saveSlot(n, name) {
    const theme = captureTheme(name);
    localStorage.setItem(LS_SLOT(n), JSON.stringify(theme));
    localStorage.setItem(LS_ACTIVE, String(n));
    return theme;
  }

  function loadSlot(n) {
    try { return JSON.parse(localStorage.getItem(LS_SLOT(n))); } catch { return null; }
  }

  function deleteSlot(n) {
    localStorage.removeItem(LS_SLOT(n));
    if (localStorage.getItem(LS_ACTIVE) === String(n))
      localStorage.removeItem(LS_ACTIVE);
  }

  function applyTheme(theme) {
    if (!theme || !theme.vals) return;
    TOKENS.forEach(tok => {
      const v = theme.vals[tok.id];
      if (v) applyVar(tok.id, v);
    });
    syncUIToCurrentVars();
  }

  /* ─────────────────────────────────────────
     5. INJECT HTML
  ───────────────────────────────────────── */
  document.body.insertAdjacentHTML('beforeend', `
<button id="tp-hamburger" aria-label="Open theme panel" title="Design Controls">
  <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
    <rect y="0"  width="18" height="2" rx="1" fill="currentColor"/>
    <rect y="6"  width="13" height="2" rx="1" fill="currentColor"/>
    <rect y="12" width="9"  height="2" rx="1" fill="currentColor"/>
  </svg>
</button>
<div id="tp-overlay"></div>
<aside id="tp-drawer">
  <div id="tp-drawer-inner">

    <div id="tp-header">
      <span id="tp-title">Design Controls</span>
      <div id="tp-header-btns">
        <button id="tp-reset-btn" title="Reset to defaults">Reset</button>
        <button id="tp-export-btn" title="Copy CSS to clipboard">Export</button>
        <button id="tp-close-btn" aria-label="Close">✕</button>
      </div>
    </div>

    <!-- THEMES SECTION -->
    <div id="tp-themes-section">
      <div id="tp-themes-label">Saved Themes</div>
      <div id="tp-slots"></div>
    </div>

    <div id="tp-search-wrap">
      <input id="tp-search" type="text" placeholder="Search controls…" autocomplete="off" />
    </div>

    <div id="tp-body"></div>
  </div>
</aside>
<div id="tp-toast"></div>
  `);

  /* ─────────────────────────────────────────
     6. STYLES
  ───────────────────────────────────────── */
  document.head.insertAdjacentHTML('beforeend', `<style>
    /* ── Hamburger ── */
    #tp-hamburger {
      position:fixed; top:10px; right:10px; z-index:1040;
      width:42px; height:42px; border-radius:10px;
      background:var(--panel,#121614); border:1px solid var(--line,#232b28);
      color:var(--muted,#8a978f); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      transition:border-color .15s,color .15s,box-shadow .15s;
    }
    #tp-hamburger:hover { border-color:var(--accent,#34d399); color:var(--accent,#34d399); box-shadow:0 0 0 3px rgba(52,211,153,.15); }

    /* ── Overlay ── */
    #tp-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(2px);
      opacity:0; pointer-events:none; transition:opacity .2s; z-index:1045;
    }
    #tp-overlay.tp-open { opacity:1; pointer-events:auto; }

    /* ── Drawer ── */
    #tp-drawer {
      position:fixed; top:0; right:0; height:100%; width:360px; max-width:92vw;
      background:var(--panel,#121614); border-left:1px solid var(--line,#232b28);
      z-index:1050; transform:translateX(102%);
      transition:transform .27s cubic-bezier(.4,0,.2,1);
      display:flex; flex-direction:column; overflow:hidden;
    }
    #tp-drawer.tp-open { transform:translateX(0); }
    #tp-drawer-inner { display:flex; flex-direction:column; height:100%; }

    /* ── Header ── */
    #tp-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 18px 14px; border-bottom:1px solid var(--line,#232b28); flex:none;
    }
    #tp-title { font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted,#8a978f); }
    #tp-header-btns { display:flex; align-items:center; gap:6px; }
    #tp-reset-btn,#tp-export-btn {
      background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--muted,#8a978f); border-radius:7px; padding:5px 10px;
      font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; transition:border-color .15s,color .15s;
    }
    #tp-reset-btn:hover  { border-color:var(--loss,#f87171); color:var(--loss,#f87171); }
    #tp-export-btn:hover { border-color:var(--accent,#34d399); color:var(--accent,#34d399); }
    #tp-close-btn { background:none; border:none; color:var(--muted,#8a978f); font-size:18px; cursor:pointer; padding:2px 6px; border-radius:6px; transition:color .15s; }
    #tp-close-btn:hover { color:var(--txt,#e8efe9); }

    /* ── Themes section ── */
    #tp-themes-section {
      padding:14px 18px 12px; border-bottom:1px solid var(--line,#232b28); flex:none;
    }
    #tp-themes-label {
      font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.22em;
      text-transform:uppercase; color:var(--muted,#8a978f); margin-bottom:10px;
    }
    #tp-slots { display:flex; flex-direction:column; gap:8px; }

    .tp-slot {
      display:grid; grid-template-columns:1fr auto auto;
      gap:6px; align-items:center;
    }
    .tp-slot-load {
      background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--txt,#e8efe9); border-radius:9px; padding:9px 12px;
      font-family:'IBM Plex Mono',monospace; font-size:12px;
      cursor:pointer; text-align:left; transition:border-color .15s,background .15s;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .tp-slot-load:hover   { border-color:var(--accent,#34d399); }
    .tp-slot-load.tp-active { border-color:var(--accent,#34d399); background:var(--accent-dim,#0f3d2e); color:var(--accent,#34d399); }
    .tp-slot-load.tp-empty  { color:var(--muted,#8a978f); font-style:italic; cursor:default; }
    .tp-slot-load.tp-empty:hover { border-color:var(--line,#232b28); }

    .tp-slot-save {
      background:var(--accent,#34d399); border:none; color:#06140d;
      border-radius:8px; padding:8px 11px; font-size:11px; font-weight:600;
      font-family:'IBM Plex Mono',monospace; cursor:pointer; white-space:nowrap;
      transition:filter .15s;
    }
    .tp-slot-save:hover { filter:brightness(1.1); }

    .tp-slot-del {
      background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--muted,#8a978f); border-radius:8px; padding:8px 10px;
      font-size:13px; cursor:pointer; transition:border-color .15s,color .15s;
    }
    .tp-slot-del:hover { border-color:var(--loss,#f87171); color:var(--loss,#f87171); }
    .tp-slot-del:disabled { opacity:.3; cursor:not-allowed; }
    .tp-slot-del:disabled:hover { border-color:var(--line,#232b28); color:var(--muted,#8a978f); }

    /* name-edit modal */
    #tp-name-modal {
      position:fixed; inset:0; z-index:2000; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,.6); backdrop-filter:blur(3px);
    }
    #tp-name-modal.tp-hidden { display:none; }
    #tp-name-box {
      background:var(--panel,#121614); border:1px solid var(--line,#232b28);
      border-radius:16px; padding:24px 22px; width:300px; max-width:90vw;
      display:flex; flex-direction:column; gap:14px;
    }
    #tp-name-box h3 { font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted,#8a978f); }
    #tp-name-input {
      background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--txt,#e8efe9); border-radius:9px; padding:11px 13px;
      font-family:'IBM Plex Mono',monospace; font-size:14px; outline:none; transition:border-color .15s;
    }
    #tp-name-input:focus { border-color:var(--accent,#34d399); }
    #tp-name-btns { display:flex; gap:8px; }
    #tp-name-ok {
      flex:1; background:var(--accent,#34d399); border:none; color:#06140d;
      border-radius:9px; padding:11px; font-weight:600; font-size:14px;
      font-family:'IBM Plex Sans',sans-serif; cursor:pointer; transition:filter .15s;
    }
    #tp-name-ok:hover { filter:brightness(1.08); }
    #tp-name-cancel {
      flex:1; background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--muted,#8a978f); border-radius:9px; padding:11px;
      font-size:14px; font-family:'IBM Plex Sans',sans-serif; cursor:pointer; transition:border-color .15s;
    }
    #tp-name-cancel:hover { border-color:var(--loss,#f87171); color:var(--loss,#f87171); }

    /* ── Search ── */
    #tp-search-wrap { padding:12px 18px 10px; flex:none; border-bottom:1px solid var(--line,#232b28); }
    #tp-search {
      width:100%; background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28);
      color:var(--txt,#e8efe9); border-radius:9px; padding:9px 12px;
      font-family:'IBM Plex Mono',monospace; font-size:13px; outline:none; transition:border-color .15s;
    }
    #tp-search:focus { border-color:var(--accent,#34d399); }
    #tp-search::placeholder { color:var(--muted,#8a978f); }

    /* ── Body scroll ── */
    #tp-body { flex:1 1 auto; overflow-y:auto; padding:8px 0 24px; scrollbar-width:thin; scrollbar-color:var(--line,#232b28) transparent; }
    #tp-body::-webkit-scrollbar { width:4px; }
    #tp-body::-webkit-scrollbar-thumb { background:var(--line,#232b28); border-radius:4px; }

    /* ── Groups ── */
    .tp-group { margin-bottom:2px; }
    .tp-group-header { display:flex; align-items:center; justify-content:space-between; padding:10px 18px 8px; cursor:pointer; user-select:none; }
    .tp-group-header:hover { background:rgba(255,255,255,.03); }
    .tp-group-label { font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted,#8a978f); }
    .tp-group-arrow { color:var(--muted,#8a978f); font-size:11px; transition:transform .2s; }
    .tp-group.collapsed .tp-group-arrow { transform:rotate(-90deg); }
    .tp-group-body { padding:0 18px 6px; }
    .tp-group.collapsed .tp-group-body { display:none; }

    /* ── Rows ── */
    .tp-row { margin-bottom:14px; }
    .tp-row-label { font-size:12px; color:var(--muted,#8a978f); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; }
    .tp-row-label span { font-family:'IBM Plex Mono',monospace; color:var(--txt,#e8efe9); font-size:11px; }

    /* color */
    .tp-color-wrap { display:flex; align-items:center; gap:8px; }
    .tp-color-swatch { width:36px; height:36px; border-radius:8px; border:1px solid var(--line,#232b28); cursor:pointer; overflow:hidden; flex:none; position:relative; }
    .tp-color-swatch input[type=color] { position:absolute; inset:-4px; width:calc(100% + 8px); height:calc(100% + 8px); opacity:0; cursor:pointer; border:none; padding:0; }
    .tp-color-hex { flex:1; background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28); color:var(--txt,#e8efe9); border-radius:8px; padding:8px 10px; font-family:'IBM Plex Mono',monospace; font-size:13px; outline:none; transition:border-color .15s; }
    .tp-color-hex:focus { border-color:var(--accent,#34d399); }

    /* range */
    .tp-range-wrap { display:flex; align-items:center; gap:10px; }
    .tp-range-wrap input[type=range] { flex:1; -webkit-appearance:none; appearance:none; height:4px; border-radius:4px; background:var(--line,#232b28); outline:none; }
    .tp-range-wrap input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:var(--accent,#34d399); cursor:pointer; }
    .tp-range-wrap input[type=range]::-moz-range-thumb { width:16px; height:16px; border:none; border-radius:50%; background:var(--accent,#34d399); cursor:pointer; }
    .tp-range-num { background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28); color:var(--txt,#e8efe9); border-radius:7px; padding:4px 8px; font-family:'IBM Plex Mono',monospace; font-size:12px; width:60px; text-align:right; outline:none; transition:border-color .15s; }
    .tp-range-num:focus { border-color:var(--accent,#34d399); }

    /* select */
    .tp-select { width:100%; background:var(--panel-2,#161b19); border:1px solid var(--line,#232b28); color:var(--txt,#e8efe9); border-radius:9px; padding:9px 12px; font-family:'IBM Plex Mono',monospace; font-size:13px; outline:none; cursor:pointer; transition:border-color .15s; appearance:none; }
    .tp-select:focus { border-color:var(--accent,#34d399); }

    #tp-no-results { padding:20px 18px; color:var(--muted,#8a978f); font-size:13px; text-align:center; }

    /* ── Toast ── */
    #tp-toast { position:fixed; bottom:24px; right:24px; z-index:9999; background:var(--panel,#121614); border:1px solid var(--accent,#34d399); color:var(--accent,#34d399); border-radius:10px; padding:10px 18px; font-family:'IBM Plex Mono',monospace; font-size:13px; opacity:0; transform:translateY(8px); pointer-events:none; transition:opacity .2s,transform .2s; }
    #tp-toast.tp-show { opacity:1; transform:translateY(0); }
  </style>`);

  /* name-edit modal */
  document.body.insertAdjacentHTML('beforeend', `
    <div id="tp-name-modal" class="tp-hidden">
      <div id="tp-name-box">
        <h3>Name this theme</h3>
        <input id="tp-name-input" type="text" maxlength="28" placeholder="e.g. Dark Emerald" />
        <div id="tp-name-btns">
          <button id="tp-name-ok">Save</button>
          <button id="tp-name-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `);

  /* ─────────────────────────────────────────
     7. TOAST
  ───────────────────────────────────────── */
  let toastTimer = null;
  function showToast(msg) {
    const t = document.getElementById('tp-toast');
    t.textContent = msg;
    t.classList.add('tp-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('tp-show'), 2200);
  }

  /* ─────────────────────────────────────────
     8. NAME MODAL
  ───────────────────────────────────────── */
  let _nameResolve = null;

  function askName(defaultVal) {
    return new Promise(resolve => {
      _nameResolve = resolve;
      const modal = document.getElementById('tp-name-modal');
      const input = document.getElementById('tp-name-input');
      input.value = defaultVal || '';
      modal.classList.remove('tp-hidden');
      setTimeout(() => { input.focus(); input.select(); }, 50);
    });
  }

  function confirmName() {
    const v = document.getElementById('tp-name-input').value.trim();
    document.getElementById('tp-name-modal').classList.add('tp-hidden');
    if (_nameResolve) { _nameResolve(v || null); _nameResolve = null; }
  }
  function cancelName() {
    document.getElementById('tp-name-modal').classList.add('tp-hidden');
    if (_nameResolve) { _nameResolve(null); _nameResolve = null; }
  }

  document.getElementById('tp-name-ok').addEventListener('click', confirmName);
  document.getElementById('tp-name-cancel').addEventListener('click', cancelName);
  document.getElementById('tp-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmName();
    if (e.key === 'Escape') cancelName();
  });

  /* ─────────────────────────────────────────
     9. THEME SLOTS UI  (3 slots)
  ───────────────────────────────────────── */
  const SLOT_COUNT = 3;
  const slotsContainer = document.getElementById('tp-slots');
  const activeSlot = () => localStorage.getItem(LS_ACTIVE);

  function renderSlots() {
    slotsContainer.innerHTML = '';
    for (let n = 1; n <= SLOT_COUNT; n++) {
      const theme = loadSlot(n);
      const isActive = activeSlot() === String(n);
      const isEmpty = !theme;

      const row = document.createElement('div');
      row.className = 'tp-slot';

      const loadBtn = document.createElement('button');
      loadBtn.className = 'tp-slot-load' + (isEmpty ? ' tp-empty' : '') + (isActive ? ' tp-active' : '');
      loadBtn.textContent = isEmpty ? `Slot ${n} — empty` : theme.name;
      loadBtn.title = isEmpty ? 'Save a theme to this slot first' : `Load: ${theme.name}`;

      const saveBtn = document.createElement('button');
      saveBtn.className = 'tp-slot-save';
      saveBtn.textContent = isEmpty ? 'Save' : '↺';
      saveBtn.title = isEmpty ? `Save current theme to slot ${n}` : `Overwrite slot ${n}`;

      const delBtn = document.createElement('button');
      delBtn.className = 'tp-slot-del';
      delBtn.textContent = '✕';
      delBtn.title = isEmpty ? 'Empty slot' : `Delete slot ${n}`;
      delBtn.disabled = isEmpty;

      // LOAD
      if (!isEmpty) {
        loadBtn.addEventListener('click', () => {
          applyTheme(theme);
          localStorage.setItem(LS_ACTIVE, String(n));
          renderSlots();
          showToast(`Loaded: ${theme.name}`);
        });
      }

      // SAVE
      saveBtn.addEventListener('click', async () => {
        const existing = loadSlot(n);
        const name = await askName(existing ? existing.name : `Theme ${n}`);
        if (!name) return;
        saveSlot(n, name);
        renderSlots();
        showToast(`Saved to slot ${n}: ${name}`);
      });

      // DELETE
      delBtn.addEventListener('click', () => {
        if (!loadSlot(n)) return;
        if (!confirm(`Delete "${theme.name}"?`)) return;
        deleteSlot(n);
        renderSlots();
        showToast(`Slot ${n} cleared`);
      });

      row.appendChild(loadBtn);
      row.appendChild(saveBtn);
      row.appendChild(delBtn);
      slotsContainer.appendChild(row);
    }
  }

  renderSlots();

  /* ─────────────────────────────────────────
     10. BUILD CONTROLS
  ───────────────────────────────────────── */
  const body   = document.getElementById('tp-body');
  const rowEls = [];

  const groups = {};
  TOKENS.forEach(t => { if (!groups[t.group]) groups[t.group] = []; groups[t.group].push(t); });

  Object.entries(groups).forEach(([groupName, tokens]) => {
    const gDiv = document.createElement('div');
    gDiv.className = 'tp-group';
    gDiv.innerHTML = `
      <div class="tp-group-header">
        <span class="tp-group-label">${groupName}</span>
        <span class="tp-group-arrow">▾</span>
      </div>
      <div class="tp-group-body"></div>`;
    const gBody = gDiv.querySelector('.tp-group-body');
    gDiv.querySelector('.tp-group-header').addEventListener('click', () => gDiv.classList.toggle('collapsed'));

    tokens.forEach(tok => {
      const row = document.createElement('div');
      row.className = 'tp-row';
      row.dataset.search = (tok.label + ' ' + tok.id).toLowerCase();

      if (tok.type === 'color') {
        applyVar(tok.id, tok.def);
        row.innerHTML = `
          <div class="tp-row-label">${tok.label} <span>${tok.def}</span></div>
          <div class="tp-color-wrap">
            <div class="tp-color-swatch" style="background:${tok.def}">
              <input type="color" value="${tok.def}" />
            </div>
            <input type="text" class="tp-color-hex" value="${tok.def}" maxlength="9" />
          </div>`;
        const swatch = row.querySelector('.tp-color-swatch');
        const picker = row.querySelector('input[type=color]');
        const hex    = row.querySelector('.tp-color-hex');
        const badge  = row.querySelector('.tp-row-label span');
        const set = v => { applyVar(tok.id, v); swatch.style.background = v; badge.textContent = v; picker.value = v.length===7?v:picker.value; hex.value = v; };
        picker.addEventListener('input', () => set(picker.value));
        hex.addEventListener('input', () => { const v=hex.value.trim(); if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) set(v); });

      } else if (tok.type === 'px') {
        applyVar(tok.id, tok.def + 'px');
        row.innerHTML = `
          <div class="tp-row-label">${tok.label} <span>${tok.def}px</span></div>
          <div class="tp-range-wrap">
            <input type="range" min="${tok.min}" max="${tok.max}" step="1" value="${tok.def}" />
            <input type="number" class="tp-range-num" value="${tok.def}" min="${tok.min}" max="${tok.max}" />
          </div>`;
        const range = row.querySelector('input[type=range]');
        const num   = row.querySelector('.tp-range-num');
        const badge = row.querySelector('.tp-row-label span');
        const set = v => { v=Math.max(tok.min,Math.min(tok.max,Number(v))); applyVar(tok.id,v+'px'); range.value=v; num.value=v; badge.textContent=v+'px'; };
        range.addEventListener('input', () => set(range.value));
        num.addEventListener('change', () => set(num.value));

      } else if (tok.type === 'select') {
        applyVar(tok.id, tok.def);
        row.innerHTML = `
          <div class="tp-row-label">${tok.label}</div>
          <select class="tp-select">${tok.options.map(o=>`<option value="${o}"${o===tok.def?' selected':''}>${o}</option>`).join('')}</select>`;
        const sel = row.querySelector('select');
        sel.addEventListener('change', () => applyVar(tok.id, sel.value));
      }

      gBody.appendChild(row);
      rowEls.push({ el: row, gDiv });
    });
    body.appendChild(gDiv);
  });

  const noResults = document.createElement('div');
  noResults.id = 'tp-no-results';
  noResults.textContent = 'No controls found.';
  noResults.style.display = 'none';
  body.appendChild(noResults);

  /* ─────────────────────────────────────────
     11. SYNC UI ← current CSS vars
         (called after loading a theme)
  ───────────────────────────────────────── */
  function syncUIToCurrentVars() {
    TOKENS.forEach(tok => {
      const live = root.style.getPropertyValue(tok.id) ||
                   getComputedStyle(root).getPropertyValue(tok.id).trim();
      if (!live) return;

      rowEls.forEach(({ el }) => {
        if (!el.dataset.search.includes(tok.id)) return;

        if (tok.type === 'color') {
          const picker = el.querySelector('input[type=color]');
          const hex    = el.querySelector('.tp-color-hex');
          const swatch = el.querySelector('.tp-color-swatch');
          const badge  = el.querySelector('.tp-row-label span');
          if (picker) picker.value = live.length===7 ? live : picker.value;
          if (hex)    hex.value    = live;
          if (swatch) swatch.style.background = live;
          if (badge)  badge.textContent = live;
        } else if (tok.type === 'px') {
          const numVal = parseInt(live, 10);
          const range  = el.querySelector('input[type=range]');
          const num    = el.querySelector('.tp-range-num');
          const badge  = el.querySelector('.tp-row-label span');
          if (range) range.value = numVal;
          if (num)   num.value   = numVal;
          if (badge) badge.textContent = numVal + 'px';
        } else if (tok.type === 'select') {
          const sel = el.querySelector('select');
          if (sel) sel.value = live;
        }
      });
    });
  }

  /* ─────────────────────────────────────────
     12. SEARCH
  ───────────────────────────────────────── */
  document.getElementById('tp-search').addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    let visible = 0;
    rowEls.forEach(({ el, gDiv }) => {
      const match = !q || el.dataset.search.includes(q);
      el.style.display = match ? '' : 'none';
      if (match) visible++;
      const any = [...gDiv.querySelectorAll('.tp-row')].some(r => r.style.display !== 'none');
      gDiv.style.display = any ? '' : 'none';
      if (q && any) gDiv.classList.remove('collapsed');
    });
    noResults.style.display = visible === 0 ? '' : 'none';
  });

  /* ─────────────────────────────────────────
     13. RESET
  ───────────────────────────────────────── */
  document.getElementById('tp-reset-btn').addEventListener('click', () => {
    TOKENS.forEach(tok => applyVar(tok.id, tok.type==='px' ? tok.def+'px' : tok.def));
    syncUIToCurrentVars();
    localStorage.removeItem(LS_ACTIVE);
    renderSlots();
    showToast('Reset to defaults');
  });

  /* ─────────────────────────────────────────
     14. EXPORT
  ───────────────────────────────────────── */
  document.getElementById('tp-export-btn').addEventListener('click', () => {
    const lines = [':root {'];
    TOKENS.forEach(tok => {
      const v = (root.style.getPropertyValue(tok.id) || getComputedStyle(root).getPropertyValue(tok.id)).trim();
      lines.push(`  ${tok.id}: ${v};`);
    });
    lines.push('}');
    const css = lines.join('\n');
    navigator.clipboard.writeText(css)
      .then(() => showToast('CSS vars copied!'))
      .catch(() => { const ta=document.createElement('textarea'); ta.value=css; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('CSS vars copied!'); });
  });

  /* ─────────────────────────────────────────
     15. OPEN / CLOSE
  ───────────────────────────────────────── */
  const openPanel  = () => { document.getElementById('tp-drawer').classList.add('tp-open'); document.getElementById('tp-overlay').classList.add('tp-open'); };
  const closePanel = () => { document.getElementById('tp-drawer').classList.remove('tp-open'); document.getElementById('tp-overlay').classList.remove('tp-open'); };
  document.getElementById('tp-hamburger').addEventListener('click', openPanel);
  document.getElementById('tp-overlay').addEventListener('click', closePanel);
  document.getElementById('tp-close-btn').addEventListener('click', closePanel);

  /* ─────────────────────────────────────────
     16. BOOT — apply active theme or defaults
  ───────────────────────────────────────── */
  const bootSlot = localStorage.getItem(LS_ACTIVE);
  if (bootSlot) {
    const saved = loadSlot(Number(bootSlot));
    if (saved) {
      applyTheme(saved);
      // sync after a short tick so DOM is ready
      setTimeout(syncUIToCurrentVars, 0);
    }
  } else {
    TOKENS.forEach(tok => applyVar(tok.id, tok.type==='px' ? tok.def+'px' : tok.def));
  }

})();
