/**
 * Grandmaster AI Chess Assistant - World-Scale User Interface
 * Designed & Developed by Ehsan Shahbazi
 * Version: 3.0 Pro
 * GitHub: https://github.com/EhsanShahbazii
 */

(function() {
  'use strict';

  window.chessHelper = {
    version: '3.0 Pro',
    author: 'Ehsan Shahbazi',
    github: 'https://github.com/EhsanShahbazii'
  };

  const FILE_TO_NUM = { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6, 'g': 7, 'h': 8 };

  const ENGINE_DEPTHS = {
    'hybrid': { min: 8, max: 25, default: 14, label: 'Adaptive Depth', fullName: 'Auto-Hybrid (Tablebase + Cloud + Stockfish)' },
    'stockfish': { min: 6, max: 18, default: 13, label: 'Search Depth', fullName: 'Stockfish 16+ Online API' },
    'lichess': { min: 30, max: 55, default: 45, label: 'Cloud Search Depth', fullName: 'Lichess Cloud GM Database' },
    'tablebase': { min: 1, max: 1, default: 1, label: 'Endgame Tablebase', fullName: 'Syzygy 7-Piece Endgame Tablebase' }
  };

  const DEFAULT_SETTINGS = {
    autoplay: false,
    engine: 'hybrid',
    depth: 14,
    autoDepth: true,
    delay: 1100,
    humanize: true,
    jitter: true,
    visualize: true,
    showThreats: true,
    stealthMode: false,
    soundAlerts: false
  };

  let settings = { ...DEFAULT_SETTINGS };
  const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  function loadSettings(callback) {
    if (hasStorage) {
      chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (result) => {
        settings = { ...DEFAULT_SETTINGS, ...result };
        if (callback) callback(settings);
      });
    } else {
      try {
        const local = localStorage.getItem('ehsan_chess_settings');
        if (local) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch (e) {}
      if (callback) callback(settings);
    }
  }

  function saveSetting(key, value) {
    settings[key] = value;
    if (hasStorage) {
      chrome.storage.local.set({ [key]: value });
    } else {
      try {
        localStorage.setItem('ehsan_chess_settings', JSON.stringify(settings));
      } catch (e) {}
    }
  }

  let rootEl, bubbleEl, panelEl;
  let activeTab = 'dashboard';
  let isStealthHidden = false;
  let telemetryPage = 1;
  const telemetryPerPage = 4;

  const dragInfo = {
    active: false,
    currentX: 0,
    currentY: 0,
    initialX: 0,
    initialY: 0,
    xOffset: 0,
    yOffset: 0,
    velocityX: 0,
    velocityY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0
  };

  function playBeep(freq = 600, duration = 0.08) {
    if (!settings.soundAlerts) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // Modern SVG Icons
  const ICONS = {
    knight: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 21a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3M16.5 18C15 15.5 13.5 13 13.5 10c0-3 2.5-4.5 2.5-4.5S13 4 10.5 5c-3 1.2-4.5 4-4.5 7v3m4.5-9c0 1.5-1.5 2.5-3 2.5" /></svg>`,
    cpu: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    crosshairs: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
    broom: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"/><path d="M18 10V2l-4 4 4 4Z"/><path d="m14 6 4 4"/></svg>`,
    github: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`
  };

  function initUI() {
    const existing = document.getElementById('chess-helper-root');
    if (existing) existing.remove();

    rootEl = document.createElement('div');
    rootEl.id = 'chess-helper-root';

    // 1. Floating Bubble
    bubbleEl = document.createElement('div');
    bubbleEl.id = 'chess-helper-bubble';
    bubbleEl.title = 'Grandmaster AI Pro (Click to open, Alt+H for Stealth)';
    bubbleEl.innerHTML = `
      <div class="ch-bubble-inner">
        ${ICONS.knight}
        <span class="ch-bubble-badge" id="ch-bubble-eval">0.0</span>
      </div>
    `;

    dragInfo.xOffset = window.innerWidth - 85;
    dragInfo.yOffset = window.innerHeight - 150;
    if (dragInfo.xOffset < 20) dragInfo.xOffset = window.innerWidth - 85;
    if (dragInfo.yOffset < 20) dragInfo.yOffset = window.innerHeight - 200;
    updateBubblePosition();

    // 2. Main Chess.com-Themed Panel
    panelEl = document.createElement('div');
    panelEl.id = 'chess-helper-panel';
    panelEl.innerHTML = `
      <!-- Clean Header -->
      <div class="ch-header">
        <div class="ch-title-box">
          <span class="ch-title">GRANDMASTER AI</span>
          <span class="ch-badge-pro">PRO 3.0</span>
        </div>
        <div class="ch-header-actions">
          <div class="ch-status-indicator" id="ch-turn-dot" title="Game Status"></div>
          <button class="ch-btn-icon" id="ch-btn-close" title="Collapse Panel">✕</button>
        </div>
      </div>

      <!-- Navigation Tabs (SVG Icons) -->
      <div class="ch-nav-tabs">
        <button class="ch-tab-btn active" data-tab="dashboard">${ICONS.knight}<span>Play</span></button>
        <button class="ch-tab-btn" data-tab="engine">${ICONS.cpu}<span>Engine</span></button>
        <button class="ch-tab-btn" data-tab="status">${ICONS.chart}<span>Status</span></button>
        <button class="ch-tab-btn" data-tab="stealth">${ICONS.shield}<span>Stealth</span></button>
        <button class="ch-tab-btn" data-tab="about">${ICONS.info}<span>About</span></button>
      </div>

      <!-- TAB 1: DASHBOARD / PLAY -->
      <div class="ch-tab-content active" id="tab-dashboard">
        <!-- Active Engine Model Banner -->
        <div class="ch-model-banner">
          <div class="ch-model-left">
            <span class="ch-model-dot"></span>
            <span class="ch-model-title">Active Model:</span>
          </div>
          <span class="ch-model-name" id="ch-home-engine-model">Auto-Hybrid Cascade</span>
        </div>

        <div class="ch-card ch-card-eval">
          <div class="ch-eval-top">
            <div class="ch-eval-title-group">
              <span class="ch-eval-label">Position Evaluation</span>
              <span class="ch-eval-depth-tag" id="ch-eval-depth-tag">Depth 14</span>
            </div>
            <span class="ch-eval-badge ch-badge-neutral" id="ch-eval-score">0.00</span>
          </div>

          <div class="ch-win-bar-wrap">
            <div class="ch-win-bar-fill" id="ch-eval-bar-fill" style="width: 50%;"></div>
          </div>
          <div class="ch-win-stats" id="ch-win-stats">
            <span>White: 50%</span>
            <span>Black: 50%</span>
          </div>

          <div class="ch-info-row" id="ch-opening-row" style="display:none;">
            <span class="ch-info-tag">Opening:</span>
            <span class="ch-info-val" id="ch-opening-text">-</span>
          </div>

          <div class="ch-continuation-box">
            <span class="ch-continuation-label">Best Line:</span>
            <span class="ch-continuation" id="ch-continuation">Ready for analysis...</span>
          </div>
        </div>

        <div class="ch-card">
          <div class="ch-row">
            <div class="ch-label-group">
              <span class="ch-label">Auto-Play Moves</span>
              <span class="ch-sublabel">Executes calculated best moves automatically</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-autoplay">
              <span class="ch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ch-actions">
          <button class="ch-btn ch-btn-primary" id="ch-btn-analyze">
            ${ICONS.crosshairs}
            <span id="ch-analyze-text">Analyze Best Move</span>
          </button>
          <button class="ch-btn ch-btn-secondary" id="ch-btn-clear" title="Clear Visual Markers">
            ${ICONS.broom}
            <span>Clear</span>
          </button>
        </div>
      </div>

      <!-- TAB 2: ENGINE CONFIG & DYNAMIC DEPTH -->
      <div class="ch-tab-content" id="tab-engine">
        <div class="ch-card">
          <div class="ch-setting-row">
            <label class="ch-label">Primary Chess Engine</label>
            <select class="ch-select" id="ch-select-engine">
              <option value="hybrid">✨ Auto-Hybrid (Tablebase + Cloud + Stockfish)</option>
              <option value="stockfish">⚡ Stockfish 16+ Online API</option>
              <option value="lichess">☁️ Lichess Cloud GM Database</option>
              <option value="tablebase">👑 Syzygy 7-Piece Endgame Tablebase</option>
            </select>
          </div>

          <div class="ch-row" style="margin-top: 12px;">
            <div class="ch-label-group">
              <span class="ch-label">Auto Dynamic Depth</span>
              <span class="ch-sublabel">Scales depth based on game stage & piece count</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-autodepth">
              <span class="ch-slider"></span>
            </label>
          </div>

          <div class="ch-setting-row" id="ch-depth-slider-wrap" style="margin-top: 10px;">
            <div class="ch-setting-header">
              <span class="ch-label" id="ch-depth-label">Search Depth:</span>
              <strong id="ch-val-depth">14</strong>
            </div>
            <input type="range" id="ch-slider-depth" min="6" max="18" step="1">
            <span class="ch-sublabel" id="ch-depth-sublabel">Dynamically optimized for selected engine</span>
          </div>
        </div>

        <div class="ch-card">
          <div class="ch-row">
            <div class="ch-label-group">
              <span class="ch-label">Visual Move Vectors</span>
              <span class="ch-sublabel">Draw authentic Chess.com style move vectors & target highlights</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-visualize">
              <span class="ch-slider"></span>
            </label>
          </div>

          <div class="ch-row" style="margin-top: 8px;">
            <div class="ch-label-group">
              <span class="ch-label">Audio Chimes</span>
              <span class="ch-sublabel">Plays subtle ping on turn calculation</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-sound">
              <span class="ch-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- TAB 3: STATUS, TELEMETRY & API HEALTH (PAGINATED) -->
      <div class="ch-tab-content" id="tab-status">
        <div class="ch-card">
          <div class="ch-stats-grid">
            <div class="ch-stat-box">
              <span class="ch-stat-num" id="stat-total-calls">0</span>
              <span class="ch-stat-lbl">API CALLS</span>
            </div>
            <div class="ch-stat-box">
              <span class="ch-stat-num" id="stat-avg-latency">0ms</span>
              <span class="ch-stat-lbl">AVG LATENCY</span>
            </div>
            <div class="ch-stat-box">
              <span class="ch-stat-num" id="stat-success-rate">100%</span>
              <span class="ch-stat-lbl">SUCCESS RATE</span>
            </div>
            <div class="ch-stat-box">
              <span class="ch-stat-num" id="stat-failovers">0</span>
              <span class="ch-stat-lbl">FAILOVERS</span>
            </div>
          </div>
        </div>

        <div class="ch-card">
          <span class="ch-card-title">Engine Health & Latency</span>
          <div class="ch-api-table">
            <div class="ch-api-row">
              <div class="ch-api-info">
                <span class="ch-api-name">Syzygy 7-Piece Tablebase</span>
                <span class="ch-badge-healthy" id="health-tablebase">Online</span>
              </div>
              <div class="ch-latency-bar"><div class="ch-latency-fill" id="bar-tablebase" style="width: 25%;"></div></div>
            </div>

            <div class="ch-api-row">
              <div class="ch-api-info">
                <span class="ch-api-name">Lichess Cloud GM AI</span>
                <span class="ch-badge-healthy" id="health-lichess">Online</span>
              </div>
              <div class="ch-latency-bar"><div class="ch-latency-fill" id="bar-lichess" style="width: 35%;"></div></div>
            </div>

            <div class="ch-api-row">
              <div class="ch-api-info">
                <span class="ch-api-name">Stockfish 16+ Online API</span>
                <span class="ch-badge-healthy" id="health-stockfish">Online</span>
              </div>
              <div class="ch-latency-bar"><div class="ch-latency-fill" id="bar-stockfish" style="width: 50%;"></div></div>
            </div>
          </div>
        </div>

        <!-- Telemetry Activity with Pagination -->
        <div class="ch-card">
          <div class="ch-card-header-row">
            <span class="ch-card-title">Recent Telemetry Activity</span>
            <div class="ch-pagination-controls">
              <button class="ch-page-btn" id="ch-log-prev" title="Previous Page">◀</button>
              <span class="ch-page-indicator" id="ch-log-page-info">1 / 1</span>
              <button class="ch-page-btn" id="ch-log-next" title="Next Page">▶</button>
            </div>
          </div>
          <div class="ch-logs-list" id="ch-logs-list">
            <div class="ch-log-entry"><span class="ch-log-time">Now</span> <span class="ch-log-text">Telemetry monitor initialized</span></div>
          </div>
        </div>
      </div>

      <!-- TAB 4: STEALTH & HUMANIZATION -->
      <div class="ch-tab-content" id="tab-stealth">
        <div class="ch-card">
          <div class="ch-setting-row">
            <div class="ch-setting-header">
              <span class="ch-label">Move Delay:</span>
              <span><strong id="ch-val-delay">1100</strong> ms</span>
            </div>
            <input type="range" id="ch-slider-delay" min="400" max="4500" step="50">
          </div>

          <div class="ch-row" style="margin-top: 8px;">
            <div class="ch-label-group">
              <span class="ch-label">Humanized Timing Curves</span>
              <span class="ch-sublabel">Organic ±30% cognitive delay variance</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-humanize">
              <span class="ch-slider"></span>
            </label>
          </div>

          <div class="ch-row" style="margin-top: 8px;">
            <div class="ch-label-group">
              <span class="ch-label">Micro-Jitter Mouse Path</span>
              <span class="ch-sublabel">Simulates organic human hand trajectory</span>
            </div>
            <label class="ch-switch">
              <input type="checkbox" id="ch-toggle-jitter">
              <span class="ch-slider"></span>
            </label>
          </div>
        </div>

        <div class="ch-card">
          <div class="ch-label" style="margin-bottom: 6px;">Emergency Panic Mode</div>
          <button class="ch-btn ch-btn-panic" id="ch-btn-panic">
            ${ICONS.shield}
            <span>Hide Assistant (Alt+H)</span>
          </button>
          <span class="ch-sublabel" style="text-align: center; margin-top: 4px;">Press Alt+H anytime to instantly toggle visibility</span>
        </div>
      </div>

      <!-- TAB 5: ABOUT & FAIR PLAY DISCLAIMER -->
      <div class="ch-tab-content" id="tab-about">
        <div class="ch-card ch-about-card">
          <div class="ch-about-title">Grandmaster AI Pro</div>
          <div class="ch-about-desc">
            A world-scale next-generation chess analysis assistant and hybrid evaluation system.
          </div>

          <a href="https://github.com/EhsanShahbazii" target="_blank" class="ch-github-btn">
            ${ICONS.github}
            <span>Follow @EhsanShahbazii on GitHub</span>
          </a>
        </div>

        <!-- Educational & Fair Play Disclaimer -->
        <div class="ch-card ch-disclaimer-card">
          <div class="ch-disclaimer-header">
            ${ICONS.shield}
            <span class="ch-disclaimer-title">Training & Educational Purpose</span>
          </div>
          <p class="ch-disclaimer-text">
            This tool is engineered exclusively for <strong>game analysis, opening preparation, bot sparring, and tactical training</strong>.
          </p>
          <p class="ch-disclaimer-subtext">
            Please adhere to the community fair play guidelines and terms of service of online chess platforms. Do not use real-time engine assistance during rated matches against human players.
          </p>
        </div>

        <div class="ch-card">
          <div class="ch-card-title">Keyboard Shortcuts</div>
          <div class="ch-shortcut-list">
            <div class="ch-shortcut-item"><kbd>Alt + A</kbd> <span>Analyze Best Move</span></div>
            <div class="ch-shortcut-item"><kbd>Alt + S</kbd> <span>Toggle Auto-Play</span></div>
            <div class="ch-shortcut-item"><kbd>Alt + C</kbd> <span>Clear Overlays</span></div>
            <div class="ch-shortcut-item"><kbd>Alt + H</kbd> <span>Emergency Stealth Mode</span></div>
          </div>
        </div>
      </div>


    `;

    rootEl.appendChild(bubbleEl);
    rootEl.appendChild(panelEl);
    document.body.appendChild(rootEl);

    loadSettings(() => {
      applySettingsToUI();
      registerEventListeners();
      updateDynamicDepthUI(settings.engine);
    });
  }

  function updateDynamicDepthUI(engineKey) {
    const config = ENGINE_DEPTHS[engineKey] || ENGINE_DEPTHS['hybrid'];
    const slider = document.getElementById('ch-slider-depth');
    const label = document.getElementById('ch-depth-label');
    const val = document.getElementById('ch-val-depth');
    const wrap = document.getElementById('ch-depth-slider-wrap');
    const homeModelName = document.getElementById('ch-home-engine-model');

    if (homeModelName && config) {
      homeModelName.innerText = config.fullName;
    }

    if (slider && config) {
      slider.min = config.min;
      slider.max = config.max;
      if (settings.depth < config.min || settings.depth > config.max) {
        settings.depth = config.default;
        saveSetting('depth', config.default);
      }
      slider.value = settings.depth;
      if (val) val.innerText = settings.depth;
      if (label) label.innerText = config.label + ':';
    }

    if (wrap) {
      wrap.style.display = engineKey === 'tablebase' ? 'none' : 'block';
    }
  }

  function applySettingsToUI() {
    const toggleAutoplay = document.getElementById('ch-toggle-autoplay');
    const selectEngine = document.getElementById('ch-select-engine');
    const sliderDelay = document.getElementById('ch-slider-delay');
    const sliderDepth = document.getElementById('ch-slider-depth');
    const toggleHumanize = document.getElementById('ch-toggle-humanize');
    const toggleJitter = document.getElementById('ch-toggle-jitter');
    const toggleVisualize = document.getElementById('ch-toggle-visualize');
    const toggleSound = document.getElementById('ch-toggle-sound');
    const toggleAutoDepth = document.getElementById('ch-toggle-autodepth');
    const homeModelName = document.getElementById('ch-home-engine-model');

    const valDelay = document.getElementById('ch-val-delay');
    const valDepth = document.getElementById('ch-val-depth');

    if (toggleAutoplay) toggleAutoplay.checked = settings.autoplay;
    if (selectEngine) selectEngine.value = settings.engine || 'hybrid';
    if (sliderDelay) {
      sliderDelay.value = settings.delay;
      if (valDelay) valDelay.innerText = settings.delay;
    }
    if (sliderDepth) {
      sliderDepth.value = settings.depth;
      if (valDepth) valDepth.innerText = settings.depth;
    }
    if (toggleHumanize) toggleHumanize.checked = settings.humanize;
    if (toggleJitter) toggleJitter.checked = settings.jitter;
    if (toggleVisualize) toggleVisualize.checked = settings.visualize;
    if (toggleSound) toggleSound.checked = settings.soundAlerts;
    if (toggleAutoDepth) toggleAutoDepth.checked = settings.autoDepth;

    const config = ENGINE_DEPTHS[settings.engine] || ENGINE_DEPTHS['hybrid'];
    if (homeModelName && config) {
      homeModelName.innerText = config.fullName;
    }
  }

  function registerEventListeners() {
    const tabs = panelEl.querySelectorAll('.ch-tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panelEl.querySelectorAll('.ch-tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = 'tab-' + tab.dataset.tab;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
        activeTab = tab.dataset.tab;

        if (activeTab === 'status') {
          updateStatusTab();
        }
      });
    });

    bubbleEl.addEventListener('mousedown', onDragStart);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('mousemove', onDragging);

    bubbleEl.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    document.addEventListener('touchmove', onDragging, { passive: false });

    document.getElementById('ch-toggle-autoplay').addEventListener('change', (e) => {
      saveSetting('autoplay', e.target.checked);
      if (e.target.checked && window.chessHelperEngine && window.chessHelperEngine.triggerAutoPlay) {
        window.chessHelperEngine.triggerAutoPlay();
      }
    });

    document.getElementById('ch-select-engine').addEventListener('change', (e) => {
      saveSetting('engine', e.target.value);
      updateDynamicDepthUI(e.target.value);
      applySettingsToUI();
    });

    const toggleAutoDepth = document.getElementById('ch-toggle-autodepth');
    if (toggleAutoDepth) {
      toggleAutoDepth.addEventListener('change', (e) => {
        saveSetting('autoDepth', e.target.checked);
      });
    }

    const sliderDelay = document.getElementById('ch-slider-delay');
    const valDelay = document.getElementById('ch-val-delay');
    sliderDelay.addEventListener('input', (e) => { valDelay.innerText = e.target.value; });
    sliderDelay.addEventListener('change', (e) => { saveSetting('delay', parseInt(e.target.value)); });

    const sliderDepth = document.getElementById('ch-slider-depth');
    const valDepth = document.getElementById('ch-val-depth');
    sliderDepth.addEventListener('input', (e) => { valDepth.innerText = e.target.value; });
    sliderDepth.addEventListener('change', (e) => { saveSetting('depth', parseInt(e.target.value)); });

    document.getElementById('ch-toggle-humanize').addEventListener('change', (e) => {
      saveSetting('humanize', e.target.checked);
    });

    document.getElementById('ch-toggle-jitter').addEventListener('change', (e) => {
      saveSetting('jitter', e.target.checked);
    });

    document.getElementById('ch-toggle-visualize').addEventListener('change', (e) => {
      saveSetting('visualize', e.target.checked);
      if (!e.target.checked) clearVisualHints();
    });

    document.getElementById('ch-toggle-sound').addEventListener('change', (e) => {
      saveSetting('soundAlerts', e.target.checked);
    });

    // Telemetry Pagination listeners
    const prevBtn = document.getElementById('ch-log-prev');
    const nextBtn = document.getElementById('ch-log-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (telemetryPage > 1) {
          telemetryPage--;
          updateStatusTab();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const stats = window.chessHelperEngine ? window.chessHelperEngine.getApiStats() : null;
        const totalLogs = stats && stats.recentLogs ? stats.recentLogs.length : 0;
        const maxPage = Math.max(1, Math.ceil(totalLogs / telemetryPerPage));
        if (telemetryPage < maxPage) {
          telemetryPage++;
          updateStatusTab();
        }
      });
    }

    document.getElementById('ch-btn-panic').addEventListener('click', toggleStealthMode);
    document.getElementById('ch-btn-close').addEventListener('click', hidePanel);
    document.getElementById('ch-btn-clear').addEventListener('click', clearVisualHints);
    document.getElementById('ch-btn-analyze').onclick = triggerAnalysis;

    window.addEventListener('chessHelperUpdate', (e) => {
      const { evaluation, mate, continuation, depth, engineName, opening, telemetry } = e.detail;
      updateEvaluationUI(evaluation, mate, continuation, depth, engineName, opening);
      if (telemetry) renderTelemetry(telemetry);
      playBeep(750, 0.06);
    });

    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        triggerAnalysis();
      } else if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        const cur = !settings.autoplay;
        saveSetting('autoplay', cur);
        const toggle = document.getElementById('ch-toggle-autoplay');
        if (toggle) toggle.checked = cur;
        if (cur && window.chessHelperEngine && window.chessHelperEngine.triggerAutoPlay) window.chessHelperEngine.triggerAutoPlay();
      } else if (e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        clearVisualHints();
      } else if (e.altKey && e.code === 'KeyH') {
        e.preventDefault();
        toggleStealthMode();
      }
    });

    setInterval(updateTurnIndicator, 1000);
  }

  function updateStatusTab() {
    if (window.chessHelperEngine && window.chessHelperEngine.getApiStats) {
      renderTelemetry(window.chessHelperEngine.getApiStats());
    }
  }

  function renderTelemetry(stats) {
    if (!stats) return;

    const totalCalls = document.getElementById('stat-total-calls');
    const avgLatency = document.getElementById('stat-avg-latency');
    const successRate = document.getElementById('stat-success-rate');
    const failovers = document.getElementById('stat-failovers');

    if (totalCalls) totalCalls.innerText = stats.totalRequests;
    if (failovers) failovers.innerText = stats.fallbacks;

    let overallSum = 0;
    let count = 0;
    for (const key in stats.engineStats) {
      const s = stats.engineStats[key];
      if (s.avgLatency > 0) {
        overallSum += s.avgLatency;
        count++;
      }
    }
    if (avgLatency) avgLatency.innerText = count > 0 ? Math.round(overallSum / count) + 'ms' : '0ms';

    if (successRate && stats.totalRequests > 0) {
      const rate = Math.round((stats.successfulRequests / stats.totalRequests) * 100);
      successRate.innerText = rate + '%';
    }

    // Engine latency bars & statuses
    for (const key in stats.engineStats) {
      const s = stats.engineStats[key];
      const healthEl = document.getElementById('health-' + key);
      const barEl = document.getElementById('bar-' + key);

      if (healthEl) {
        healthEl.innerText = s.status;
        healthEl.className = s.errors > 0 && s.successes === 0 ? 'ch-badge-error' : 'ch-badge-healthy';
      }
      if (barEl) {
        const pct = Math.min(100, Math.max(10, Math.round((s.avgLatency / 1000) * 100)));
        barEl.style.width = (s.avgLatency > 0 ? pct : 20) + '%';
      }
    }

    // Paginated Logs list
    const logsList = document.getElementById('ch-logs-list');
    const pageInfo = document.getElementById('ch-log-page-info');
    const prevBtn = document.getElementById('ch-log-prev');
    const nextBtn = document.getElementById('ch-log-next');

    if (logsList && stats.recentLogs) {
      const totalLogs = stats.recentLogs.length;
      const maxPage = Math.max(1, Math.ceil(totalLogs / telemetryPerPage));
      if (telemetryPage > maxPage) telemetryPage = maxPage;

      if (pageInfo) pageInfo.innerText = `${telemetryPage} / ${maxPage}`;
      if (prevBtn) prevBtn.disabled = telemetryPage <= 1;
      if (nextBtn) nextBtn.disabled = telemetryPage >= maxPage;

      if (totalLogs === 0) {
        logsList.innerHTML = `<div class="ch-log-entry"><span class="ch-log-time">Now</span> <span class="ch-log-text">Telemetry ready</span></div>`;
      } else {
        const startIdx = (telemetryPage - 1) * telemetryPerPage;
        const pageItems = stats.recentLogs.slice(startIdx, startIdx + telemetryPerPage);

        logsList.innerHTML = pageItems.map(l => `
          <div class="ch-log-entry">
            <span class="ch-log-time">${l.timestamp}</span>
            <span class="ch-log-engine">[${l.engine.toUpperCase()}]</span>
            <span class="ch-log-msg ch-log-${l.status.toLowerCase()}">${l.message}</span>
          </div>
        `).join('');
      }
    }
  }

  function toggleStealthMode() {
    isStealthHidden = !isStealthHidden;
    if (isStealthHidden) {
      bubbleEl.style.display = 'none';
      panelEl.classList.remove('visible');
      clearVisualHints();
    } else {
      bubbleEl.style.display = 'flex';
      updateBubblePosition();
    }
  }

  async function triggerAnalysis() {
    if (!window.chessHelperEngine) return;
    
    const btnText = document.getElementById('ch-analyze-text');
    btnText.innerText = 'Calculating...';
    
    const fen = window.chessHelperEngine.getFEN();
    if (!fen) {
      btnText.innerText = 'No Game Found';
      setTimeout(() => { btnText.innerText = 'Analyze Best Move'; }, 2000);
      return;
    }

    const bestMove = await window.chessHelperEngine.fetchBestMove(fen);
    if (bestMove) {
      if (settings.visualize) visualizeMove(bestMove);
      btnText.innerText = 'Move: ' + bestMove.toUpperCase();
    } else {
      btnText.innerText = 'Engine Busy / Retrying';
    }
    
    setTimeout(() => { btnText.innerText = 'Analyze Best Move'; }, 3500);
  }

  function updateEvaluationUI(evaluation, mate, continuation, depth, engineName, opening) {
    const scoreBadge = document.getElementById('ch-eval-score');
    const bubbleBadge = document.getElementById('ch-bubble-eval');
    const continuationEl = document.getElementById('ch-continuation');
    const evalBarFill = document.getElementById('ch-eval-bar-fill');
    const winStats = document.getElementById('ch-win-stats');
    const depthTag = document.getElementById('ch-eval-depth-tag');
    const openingRow = document.getElementById('ch-opening-row');
    const openingText = document.getElementById('ch-opening-text');
    const homeModelName = document.getElementById('ch-home-engine-model');

    if (homeModelName && engineName) {
      homeModelName.innerText = engineName;
    }

    if (depthTag && depth) {
      depthTag.innerText = 'Depth ' + depth;
    }

    if (opening && openingRow && openingText) {
      openingRow.style.display = 'flex';
      openingText.innerText = opening.eco + ' - ' + opening.name;
    }

    if (!scoreBadge) return;

    let displayText = '0.00';
    let badgeClass = 'ch-badge-neutral';
    let whiteWinPct = 50;

    if (mate !== null && mate !== undefined) {
      displayText = 'M' + Math.abs(mate);
      badgeClass = mate > 0 ? 'ch-badge-mate-white' : 'ch-badge-mate-black';
      whiteWinPct = mate > 0 ? 98 : 2;
    } else if (evaluation !== undefined && evaluation !== null) {
      const score = parseFloat(evaluation);
      displayText = (score > 0 ? '+' : '') + score.toFixed(2);

      if (score > 0.4) {
        badgeClass = 'ch-badge-white-win';
      } else if (score < -0.4) {
        badgeClass = 'ch-badge-black-win';
      } else {
        badgeClass = 'ch-badge-neutral';
      }

      const winProb = 1 / (1 + Math.pow(10, -score / 4));
      whiteWinPct = Math.min(97, Math.max(3, Math.round(winProb * 100)));
    }

    scoreBadge.innerText = displayText;
    scoreBadge.className = 'ch-eval-badge ' + badgeClass;
    if (bubbleBadge) bubbleBadge.innerText = displayText;

    if (evalBarFill) {
      evalBarFill.style.width = whiteWinPct + '%';
    }

    if (winStats) {
      const blackWinPct = 100 - whiteWinPct;
      winStats.innerHTML = '<span>White: ' + whiteWinPct + '%</span><span>Black: ' + blackWinPct + '%</span>';
    }

    if (continuationEl) {
      if (continuation) {
        const moves = continuation.split(' ');
        const formatted = moves.slice(0, 6).map(m => m.toUpperCase()).join(' → ');
        continuationEl.innerText = formatted + (moves.length > 6 ? '...' : '');
      } else {
        continuationEl.innerText = 'No lines evaluated';
      }
    }
  }

  function updateTurnIndicator() {
    const turnDot = document.getElementById('ch-turn-dot');
    if (!turnDot || !window.chessHelperEngine) return;

    const fen = window.chessHelperEngine.getFEN();
    if (!fen) {
      turnDot.className = 'ch-status-indicator';
      return;
    }

    const activeColor = fen.split(' ')[1];
    const playerColor = window.chessHelperEngine.getPlayerColor();

    if (activeColor === playerColor) {
      turnDot.className = 'ch-status-indicator active-turn';
      turnDot.title = 'Your Turn to Move!';
    } else {
      turnDot.className = 'ch-status-indicator opponent-turn';
      turnDot.title = "Opponent's Turn";
    }
  }

  function onDragStart(e) {
    if (e.target.closest('#chess-helper-panel')) return;
    dragInfo.active = true;
    dragInfo.lastTime = Date.now();
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    dragInfo.initialX = clientX - dragInfo.xOffset;
    dragInfo.initialY = clientY - dragInfo.yOffset;
  }

  function onDragEnd() {
    if (!dragInfo.active) return;
    dragInfo.active = false;
    const speed = Math.sqrt(dragInfo.velocityX * dragInfo.velocityX + dragInfo.velocityY * dragInfo.velocityY);
    if (speed < 0.2) {
      togglePanel();
    } else {
      applyInertia();
    }
  }

  function onDragging(e) {
    if (!dragInfo.active) return;
    e.preventDefault();
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    dragInfo.currentX = clientX - dragInfo.initialX;
    dragInfo.currentY = clientY - dragInfo.initialY;
    const now = Date.now();
    const dt = now - dragInfo.lastTime;
    if (dt > 0) {
      dragInfo.velocityX = (dragInfo.currentX - dragInfo.xOffset) / dt;
      dragInfo.velocityY = (dragInfo.currentY - dragInfo.yOffset) / dt;
    }
    dragInfo.lastTime = now;
    dragInfo.xOffset = dragInfo.currentX;
    dragInfo.yOffset = dragInfo.currentY;
    updateBubblePosition();
    if (panelEl.classList.contains('visible')) {
      repositionPanel();
    }
  }

  function updateBubblePosition() {
    const wWidth = window.innerWidth;
    const wHeight = window.innerHeight;
    const size = 56;
    if (dragInfo.xOffset < 0) dragInfo.xOffset = 0;
    if (dragInfo.yOffset < 0) dragInfo.yOffset = 0;
    if (dragInfo.xOffset > wWidth - size) dragInfo.xOffset = wWidth - size;
    if (dragInfo.yOffset > wHeight - size) dragInfo.yOffset = wHeight - size;
    bubbleEl.style.transform = 'translate3d(' + dragInfo.xOffset + 'px, ' + dragInfo.yOffset + 'px, 0)';
  }

  function applyInertia() {
    if (dragInfo.active) return;
    dragInfo.velocityX *= 0.92;
    dragInfo.velocityY *= 0.92;
    dragInfo.xOffset += dragInfo.velocityX * 16;
    dragInfo.yOffset += dragInfo.velocityY * 16;
    updateBubblePosition();
    if (Math.abs(dragInfo.velocityX) > 0.05 || Math.abs(dragInfo.velocityY) > 0.05) {
      requestAnimationFrame(applyInertia);
    }
  }

  function togglePanel() {
    if (panelEl.classList.contains('visible')) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function showPanel() {
    repositionPanel();
    panelEl.classList.add('visible');
  }

  function hidePanel() {
    panelEl.classList.remove('visible');
  }

  function repositionPanel() {
    const bubbleRect = bubbleEl.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const panelWidth = 480;
    const panelHeight = 500;
    const gap = 16;
    
    let topPos, leftPos;
    let originX = bubbleRect.left > screenWidth / 2 ? 'right' : 'left';
    let originY = bubbleRect.top > screenHeight / 2 ? 'bottom' : 'top';

    if (bubbleRect.left > screenWidth / 2) {
      leftPos = bubbleRect.left - panelWidth - gap;
    } else {
      leftPos = bubbleRect.right + gap;
    }

    if (bubbleRect.top > screenHeight / 2) {
      topPos = bubbleRect.bottom - panelHeight;
    } else {
      topPos = bubbleRect.top;
    }

    if (leftPos < gap) leftPos = gap;
    if (leftPos + panelWidth > screenWidth - gap) leftPos = screenWidth - panelWidth - gap;
    if (topPos < gap) topPos = gap;
    if (topPos + panelHeight > screenHeight - gap) topPos = screenHeight - panelHeight - gap;

    panelEl.style.top = topPos + 'px';
    panelEl.style.left = leftPos + 'px';
    panelEl.style.transformOrigin = originX + ' ' + originY;
  }

  function clearVisualHints() {
    document.querySelectorAll('.ch-highlight, .ch-arrow-svg').forEach(el => el.remove());
  }

  function getSquarePercentCoords(squareName, isFlipped) {
    const fileIndex = FILE_TO_NUM[squareName[0]];
    const rankIndex = parseInt(squareName[1]);
    const squareSizePct = 12.5;
    const centerOffsetPct = 6.25;
    let x, y;
    if (!isFlipped) {
      x = (fileIndex - 1) * squareSizePct + centerOffsetPct;
      y = (8 - rankIndex) * squareSizePct + centerOffsetPct;
    } else {
      x = (8 - fileIndex) * squareSizePct + centerOffsetPct;
      y = (rankIndex - 1) * squareSizePct + centerOffsetPct;
    }
    return { x, y };
  }

  /**
   * Premium Authentic Chess.com Vector Arrow & Target Highlight System
   */
  function visualizeMove(moveStr) {
    clearVisualHints();
    if (!settings.visualize) return;

    const board = document.querySelector('wc-chess-board') ||
                  document.querySelector('.board') ||
                  document.querySelector('chess-board') ||
                  document.querySelector('cg-board');
    if (!board || !moveStr) return;

    const fromSquare = moveStr.substring(0, 2);
    const toSquare = moveStr.substring(2, 4);
    const isFlipped = window.chessHelperEngine ? window.chessHelperEngine.getPlayerColor() === 'b' : false;

    // 1. High-fidelity square highlights
    const highlightSquare = (square, colorClass) => {
      const highlight = document.createElement('div');
      highlight.className = 'ch-highlight ' + colorClass + ' square-' + FILE_TO_NUM[square[0]] + square[1];
      board.appendChild(highlight);
    };

    highlightSquare(fromSquare, 'ch-sq-from');
    highlightSquare(toSquare, 'ch-sq-to');

    // 2. High-precision vector arrow with Chess.com proportions
    const start = getSquarePercentCoords(fromSquare, isFlipped);
    const end = getSquarePercentCoords(toSquare, isFlipped);

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('viewBox', '0 0 100 100');
    svgEl.classList.add('ch-arrow-svg');

    // Define marker arrowhead
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'ch-chess-arrowhead');
    marker.setAttribute('markerWidth', '5');
    marker.setAttribute('markerHeight', '5');
    marker.setAttribute('refX', '3.8');
    marker.setAttribute('refY', '2.5');
    marker.setAttribute('orient', 'auto');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0.5, 4.5 2.5, 0 4.5');
    polygon.setAttribute('fill', '#81b64c');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svgEl.appendChild(defs);

    // Vector line with arrowhead
    const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineEl.setAttribute('x1', start.x);
    lineEl.setAttribute('y1', start.y);
    lineEl.setAttribute('x2', end.x);
    lineEl.setAttribute('y2', end.y);
    lineEl.classList.add('ch-premium-arrow');
    lineEl.setAttribute('marker-end', 'url(#ch-chess-arrowhead)');

    // Start base dot
    const baseDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseDot.setAttribute('cx', start.x);
    baseDot.setAttribute('cy', start.y);
    baseDot.setAttribute('r', '1.8');
    baseDot.setAttribute('fill', '#81b64c');
    baseDot.classList.add('ch-arrow-dot');

    svgEl.appendChild(lineEl);
    svgEl.appendChild(baseDot);
    board.appendChild(svgEl);

    setTimeout(clearVisualHints, 5500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
