/**
 * Grandmaster AI Chess Assistant - Multi-Engine Hybrid & Anti-Detection System
 * Designed & Developed by Ehsan Shahbazi
 * Version: 3.0 Pro
 * GitHub: https://github.com/EhsanShahbazii
 */

(function() {
  'use strict';

  const PIECE_MAP = {
    'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
    'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k',
    'white pawn': 'P', 'white knight': 'N', 'white bishop': 'B', 'white rook': 'R', 'white queen': 'Q', 'white king': 'K',
    'black pawn': 'p', 'black knight': 'n', 'black bishop': 'b', 'black rook': 'r', 'black queen': 'q', 'black king': 'k'
  };

  const FILE_TO_NUM = { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6, 'g': 7, 'h': 8 };
  const NUM_TO_FILE = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f', 7: 'g', 8: 'h' };

  // Engine depth limits
  const ENGINE_DEPTH_CONFIG = {
    'hybrid': { min: 8, max: 25, default: 14, auto: true },
    'stockfish': { min: 6, max: 18, default: 13, auto: false },
    'lichess': { min: 30, max: 55, default: 45, auto: false },
    'tablebase': { min: 1, max: 1, default: 1, auto: false }
  };

  const DEFAULT_SETTINGS = {
    autoplay: false,
    engine: 'hybrid', // 'hybrid', 'stockfish', 'lichess', 'tablebase'
    depth: 13,
    autoDepth: true,
    delay: 1100,
    humanize: true,
    jitter: true,
    visualize: true,
    showThreats: true,
    stealthMode: false,
    soundAlerts: false
  };

  // API Analytics & Telemetry
  const apiStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retries: 0,
    fallbacks: 0,
    engineStats: {
      'tablebase': { calls: 0, successes: 0, errors: 0, latencies: [], avgLatency: 0, status: 'Online' },
      'lichess': { calls: 0, successes: 0, errors: 0, latencies: [], avgLatency: 0, status: 'Online' },
      'stockfish': { calls: 0, successes: 0, errors: 0, latencies: [], avgLatency: 0, status: 'Online' }
    },
    recentLogs: []
  };

  function recordLog(engine, status, message, latencyMs = 0) {
    const timestamp = new Date().toLocaleTimeString();
    apiStats.recentLogs.unshift({ timestamp, engine, status, message, latencyMs });
    if (apiStats.recentLogs.length > 50) apiStats.recentLogs.pop();
  }

  function recordApiCall(engineKey, success, latencyMs, errorMsg = '') {
    apiStats.totalRequests++;
    const stat = apiStats.engineStats[engineKey];
    if (stat) {
      stat.calls++;
      stat.latencies.push(latencyMs);
      if (stat.latencies.length > 30) stat.latencies.shift();
      const sum = stat.latencies.reduce((a, b) => a + b, 0);
      stat.avgLatency = Math.round(sum / stat.latencies.length);

      if (success) {
        stat.successes++;
        apiStats.successfulRequests++;
        stat.status = 'Healthy (' + latencyMs + 'ms)';
        recordLog(engineKey, 'SUCCESS', 'Move calculated in ' + latencyMs + 'ms', latencyMs);
      } else {
        stat.errors++;
        apiStats.failedRequests++;
        stat.status = 'Degraded';
        recordLog(engineKey, 'ERROR', errorMsg || 'Request failed', latencyMs);
      }
    }
  }

  let settings = { ...DEFAULT_SETTINGS };
  let isAutoPlaying = false;
  let lastFEN = '';
  let activeEvaluation = null;

  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (result) => {
        settings = { ...DEFAULT_SETTINGS, ...result };
      });
    } else {
      try {
        const stored = localStorage.getItem('ehsan_chess_settings');
        if (stored) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch (e) {}
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      for (const key in changes) {
        if (key in settings) {
          settings[key] = changes[key].newValue;
        }
      }
    });
  }

  loadSettings();

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function getBoard() {
    return document.querySelector('wc-chess-board') ||
           document.querySelector('.board') ||
           document.querySelector('chess-board') ||
           document.querySelector('cg-board') ||
           document.querySelector('.main-board cg-board');
  }

  function isLichess() {
    return window.location.hostname.includes('lichess.org');
  }

  function getPlayerColor() {
    if (isLichess()) {
      const orientation = document.querySelector('.cg-wrap.orientation-black, .main-board.orientation-black');
      return orientation ? 'b' : 'w';
    }
    const board = getBoard();
    if (board) {
      if (board.classList.contains('flipped') || board.getAttribute('flipped') === 'true') {
        return 'b';
      }
    }
    return 'w';
  }

  function countPieces(fen) {
    if (!fen) return 32;
    const piecesStr = fen.split(' ')[0];
    let count = 0;
    for (const char of piecesStr) {
      if ('pnbrqkPNBRQK'.includes(char)) count++;
    }
    return count;
  }

  /**
   * Smart Dynamic Depth Calculator:
   * Adjusts engine search depth based on piece count & game stage
   */
  function calculateDynamicDepth(fen, engineKey = 'stockfish') {
    const pieces = countPieces(fen);
    if (engineKey === 'stockfish') {
      if (pieces <= 7) return 16;
      if (pieces <= 14) return 15;
      if (pieces <= 24) return 14;
      return 13;
    } else if (engineKey === 'lichess') {
      return 45;
    } else if (engineKey === 'hybrid') {
      if (pieces <= 7) return 18;
      if (pieces <= 16) return 15;
      return 13;
    }
    return settings.depth || 13;
  }

  function generateFEN() {
    const board = getBoard();
    if (!board) return null;

    if (isLichess()) {
      return generateLichessFEN(board);
    }
    return generateChessComFEN(board);
  }

  function generateLichessFEN(board) {
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    const pieces = board.querySelectorAll('piece');
    const isFlipped = getPlayerColor() === 'b';

    pieces.forEach(p => {
      const classes = Array.from(p.classList);
      let color = null;
      let role = null;
      classes.forEach(c => {
        if (c === 'white') color = 'w';
        if (c === 'black') color = 'b';
        if (['pawn','knight','bishop','rook','queen','king'].includes(c)) role = c;
      });

      const transform = p.style.transform;
      const match = /translate\((\d+)px,\s*(\d+)px\)/.exec(transform);
      if (match && color && role) {
        const x = parseInt(match[1], 10);
        const y = parseInt(match[2], 10);
        const sqSize = board.clientWidth / 8;
        let file = Math.round(x / sqSize);
        let rank = Math.round(y / sqSize);

        if (isFlipped) {
          file = 7 - file;
          rank = 7 - rank;
        }

        const roleChar = { pawn:'p', knight:'n', bishop:'b', rook:'r', queen:'q', king:'k' }[role];
        const pieceChar = color === 'w' ? roleChar.toUpperCase() : roleChar;
        if (rank >= 0 && rank < 8 && file >= 0 && file < 8) {
          grid[rank][file] = pieceChar;
        }
      }
    });

    return gridToFEN(grid);
  }

  function generateChessComFEN(board) {
    const grid = Array(8).fill(null).map(() => Array(8).fill(null));
    const pieceElements = board.querySelectorAll('.piece');
    const isFlipped = getPlayerColor() === 'b';

    pieceElements.forEach(piece => {
      let pieceChar = null;
      for (const cls of piece.classList) {
        if (PIECE_MAP[cls]) {
          pieceChar = PIECE_MAP[cls];
          break;
        }
      }

      if (!pieceChar) return;

      let fileIdx = null;
      let rankIdx = null;

      for (const cls of piece.classList) {
        if (cls.startsWith('square-')) {
          const sqStr = cls.replace('square-', '');
          fileIdx = parseInt(sqStr[0], 10);
          rankIdx = parseInt(sqStr[1], 10);
          break;
        }
      }

      if (fileIdx !== null && rankIdx !== null) {
        const col = fileIdx - 1;
        const row = 8 - rankIdx;
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
          grid[row][col] = pieceChar;
        }
      }
    });

    return gridToFEN(grid);
  }

  function gridToFEN(grid) {
    let fenRows = [];
    for (let r = 0; r < 8; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 8; c++) {
        const piece = grid[r][c];
        if (!piece) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += piece;
        }
      }
      if (emptyCount > 0) rowStr += emptyCount;
      fenRows.push(rowStr);
    }

    const activeColor = detectActiveColor();
    return `${fenRows.join('/')} ${activeColor} KQkq - 0 1`;
  }

  function detectActiveColor() {
    if (isLichess()) {
      const blackTurn = document.querySelector('.round__app.orientation-black, .turn-black');
      return blackTurn ? 'b' : 'w';
    }

    const moveList = document.querySelector('.move-list') || document.querySelector('wc-vertical-move-list');
    if (moveList) {
      const moves = moveList.querySelectorAll('.node:not(.white-node)');
      const lastMove = moves[moves.length - 1];
      if (lastMove && lastMove.classList.contains('selected')) {
        return lastMove.classList.contains('white') ? 'b' : 'w';
      }
    }

    const highlights = document.querySelectorAll('.highlight');
    if (highlights.length >= 2) {
      const board = getBoard();
      if (board) {
        const pieceOnHighlight = board.querySelector(`.piece.square-${highlights[1].className.match(/square-(\d+)/)?.[1]}`);
        if (pieceOnHighlight) {
          const isWhitePiece = Array.from(pieceOnHighlight.classList).some(c => c.startsWith('w') || c.includes('white'));
          return isWhitePiece ? 'b' : 'w';
        }
      }
    }

    return getPlayerColor();
  }

  /* =========================================================================
   * MULTI-ENGINE APIS WITH RETRY, TIMEOUT & TELEMETRY
   * ========================================================================= */

  async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return response;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  /**
   * 1. Syzygy 7-Piece Endgame Tablebase API
   */
  async function fetchTablebaseMove(fen) {
    const startTime = Date.now();
    try {
      const cleanFEN = fen.replace(/\s+/g, '_');
      const res = await fetchWithTimeout(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(cleanFEN)}`, {}, 3000);
      const latency = Date.now() - startTime;
      if (!res.ok) {
        recordApiCall('tablebase', false, latency, `HTTP ${res.status}`);
        return null;
      }
      const data = await res.json();
      if (data && data.moves && data.moves.length > 0) {
        const best = data.moves[0];
        let evalStr = '0.00';
        if (data.checkmate) evalStr = '#1';
        else if (data.dtm !== null && data.dtm !== undefined) evalStr = `DTM ${data.dtm}`;
        else if (data.dtz !== null && data.dtz !== undefined) evalStr = `DTZ ${data.dtz}`;

        recordApiCall('tablebase', true, latency);
        return {
          bestMove: best.uci,
          evaluation: evalStr,
          mate: data.checkmate ? 1 : null,
          continuation: data.moves.slice(0, 5).map(m => m.uci).join(' '),
          depth: 'Exact (Tablebase)',
          engineName: 'Syzygy 7-Piece Tablebase'
        };
      }
      recordApiCall('tablebase', false, latency, 'No tablebase moves');
    } catch (e) {
      recordApiCall('tablebase', false, Date.now() - startTime, e.message);
    }
    return null;
  }

  /**
   * 2. Lichess Cloud GM Evaluation Database
   */
  async function fetchLichessCloudEval(fen) {
    const startTime = Date.now();
    try {
      const res = await fetchWithTimeout(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, {}, 3500);
      const latency = Date.now() - startTime;
      if (!res.ok) {
        recordApiCall('lichess', false, latency, `HTTP ${res.status}`);
        return null;
      }
      const data = await res.json();
      if (data && data.pvs && data.pvs.length > 0) {
        const pv = data.pvs[0];
        const bestMove = pv.moves.split(' ')[0];
        const evaluation = pv.cp !== undefined ? (pv.cp / 100).toFixed(2) : (pv.mate ? 99 : 0);
        recordApiCall('lichess', true, latency);
        return {
          bestMove: bestMove,
          evaluation: evaluation,
          mate: pv.mate || null,
          continuation: pv.moves,
          depth: data.depth || 45,
          engineName: 'Lichess Cloud GM AI'
        };
      }
      recordApiCall('lichess', false, latency, 'Position not in cloud cache');
    } catch (e) {
      recordApiCall('lichess', false, Date.now() - startTime, e.message);
    }
    return null;
  }

  /**
   * 3. Stockfish Online v2 API (with auto-retry)
   */
  async function fetchStockfishOnline(fen, depth = 13, retryCount = 1) {
    const startTime = Date.now();
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      if (attempt > 0) {
        apiStats.retries++;
        await sleep(350);
      }
      try {
        const reqStart = Date.now();
        const res = await fetchWithTimeout(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`, {}, 4500);
        const latency = Date.now() - reqStart;
        if (!res.ok) {
          if (attempt === retryCount) recordApiCall('stockfish', false, latency, `HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        if (data && data.success && data.bestmove) {
          let bestMove = data.bestmove.split(' ')[1] || data.bestmove;
          recordApiCall('stockfish', true, latency);
          return {
            bestMove: bestMove,
            evaluation: data.evaluation,
            mate: data.mate,
            continuation: data.continuation,
            depth: depth,
            engineName: 'Stockfish 16+ Online'
          };
        }
      } catch (e) {
        if (attempt === retryCount) {
          recordApiCall('stockfish', false, Date.now() - startTime, e.message);
        }
      }
    }
    return null;
  }

  /**
   * Master Router: Intelligent Hybrid with Automatic Depth & Smart Failover
   */
  async function fetchBestMove(fen) {
    if (!fen) return null;
    let result = null;
    const selectedEngine = settings.engine || 'hybrid';
    const pieceCount = countPieces(fen);
    
    // Dynamic depth resolution
    let depth = settings.depth || 13;
    if (settings.autoDepth) {
      depth = calculateDynamicDepth(fen, selectedEngine);
    }

    // 1. Auto-Hybrid Execution Cascade
    if (selectedEngine === 'hybrid') {
      // Step A: Syzygy Tablebase if <= 7 pieces
      if (pieceCount <= 7) {
        result = await fetchTablebaseMove(fen);
      }
      // Step B: Lichess Cloud Deep Cache
      if (!result) {
        result = await fetchLichessCloudEval(fen);
      }
      // Step C: Stockfish Online v2 with Dynamic Depth
      if (!result) {
        result = await fetchStockfishOnline(fen, depth, 1);
      }
    } else if (selectedEngine === 'lichess') {
      result = await fetchLichessCloudEval(fen);
      // Smart Failover to Stockfish if Lichess cloud has no cache for this novel line
      if (!result) {
        apiStats.fallbacks++;
        recordLog('lichess', 'FAILOVER', 'Cloud cache missed, fallback to Stockfish');
        result = await fetchStockfishOnline(fen, calculateDynamicDepth(fen, 'stockfish'), 1);
      }
    } else if (selectedEngine === 'tablebase') {
      result = await fetchTablebaseMove(fen);
      if (!result) {
        apiStats.fallbacks++;
        recordLog('tablebase', 'FAILOVER', 'More than 7 pieces, fallback to Stockfish');
        result = await fetchStockfishOnline(fen, depth, 1);
      }
    } else {
      // Stockfish Direct with retry
      result = await fetchStockfishOnline(fen, depth, 2);
      if (!result) {
        // Failover to Cloud
        apiStats.fallbacks++;
        result = await fetchLichessCloudEval(fen);
      }
    }

    if (result && result.bestMove) {
      activeEvaluation = result;

      // Check Opening book if present
      let opening = null;
      if (window.chessOpenings && window.chessOpenings.identify) {
        opening = window.chessOpenings.identify(fen);
      }

      // Dispatch UI update
      const event = new CustomEvent('chessHelperUpdate', {
        detail: {
          fen: fen,
          bestMove: result.bestMove,
          evaluation: result.evaluation,
          mate: result.mate,
          continuation: result.continuation,
          depth: result.depth,
          engineName: result.engineName,
          opening: opening,
          telemetry: apiStats
        }
      });
      window.dispatchEvent(event);

      return result.bestMove;
    }

    return null;
  }

  /* =========================================================================
   * HUMANIZED MOUSE SIMULATION & MOVE DISPATCHER (BULLETPROOF SAFE)
   * ========================================================================= */

  function safeElementFromPoint(x, y, fallback) {
    try {
      if (Number.isFinite(x) && Number.isFinite(y) &&
          x >= 0 && y >= 0 &&
          x <= window.innerWidth && y <= window.innerHeight) {
        const el = document.elementFromPoint(x, y);
        if (el) return el;
      }
    } catch (e) {}
    return fallback;
  }

  function dispatchPointerEvent(type, element, coords) {
    try {
      const clientX = Number.isFinite(coords?.x) ? coords.x : 0;
      const clientY = Number.isFinite(coords?.y) ? coords.y : 0;
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        buttons: 1,
        pointerId: 1,
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: 0.5
      });
      element.dispatchEvent(event);
    } catch (e) {}
  }

  function getSquareCoordinates(squareName) {
    if (!squareName || typeof squareName !== 'string' || squareName.length < 2) return null;

    const board = getBoard();
    if (!board) return null;

    const file = squareName[0].toLowerCase();
    const rank = parseInt(squareName[1], 10);
    const fileNum = FILE_TO_NUM[file];

    if (!fileNum || isNaN(rank) || rank < 1 || rank > 8) return null;

    const isFlipped = getPlayerColor() === 'b';
    const rect = board.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || rect.width <= 0 || !Number.isFinite(rect.height) || rect.height <= 0) {
      return null;
    }

    const squareWidth = rect.width / 8;
    const squareHeight = rect.height / 8;

    let colIndex = fileNum - 1;
    let rowIndex = 8 - rank;

    if (isFlipped) {
      colIndex = 8 - fileNum;
      rowIndex = rank - 1;
    }

    // Micro-jitter anti-detection humanizer
    let offsetX = squareWidth / 2;
    let offsetY = squareHeight / 2;

    if (settings.jitter) {
      const jitterRange = squareWidth * 0.18;
      offsetX += (Math.random() * jitterRange * 2) - jitterRange;
      offsetY += (Math.random() * jitterRange * 2) - jitterRange;
    }

    const finalX = Math.round(rect.left + colIndex * squareWidth + offsetX);
    const finalY = Math.round(rect.top + rowIndex * squareHeight + offsetY);

    if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) return null;

    return { x: finalX, y: finalY };
  }

  async function executeMove(moveStr) {
    if (!moveStr || typeof moveStr !== 'string' || moveStr.length < 4) return false;

    const fromSquare = moveStr.substring(0, 2);
    const toSquare = moveStr.substring(2, 4);
    const promotion = moveStr.length > 4 ? moveStr[4] : null;

    const fromCoords = getSquareCoordinates(fromSquare);
    const toCoords = getSquareCoordinates(toSquare);

    if (!fromCoords || !toCoords ||
        !Number.isFinite(fromCoords.x) || !Number.isFinite(fromCoords.y) ||
        !Number.isFinite(toCoords.x) || !Number.isFinite(toCoords.y)) {
      return false;
    }

    const board = getBoard();
    if (!board) return false;

    let fromElement = safeElementFromPoint(fromCoords.x, fromCoords.y, board);
    dispatchPointerEvent('pointerdown', fromElement, fromCoords);
    dispatchPointerEvent('mousedown', fromElement, fromCoords);

    if (settings.humanize) {
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps;
        const currentX = Math.round(fromCoords.x + (toCoords.x - fromCoords.x) * progress);
        const currentY = Math.round(fromCoords.y + (toCoords.y - fromCoords.y) * progress);
        if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
          dispatchPointerEvent('pointermove', board, { x: currentX, y: currentY });
          dispatchPointerEvent('mousemove', board, { x: currentX, y: currentY });
        }
        await sleep(15 + Math.random() * 10);
      }
    }

    let toElement = safeElementFromPoint(toCoords.x, toCoords.y, board);
    dispatchPointerEvent('pointerup', toElement, toCoords);
    dispatchPointerEvent('mouseup', toElement, toCoords);
    safeClick(toElement, toCoords);

    if (promotion) {
      await sleep(180);
      handlePromotion(promotion);
    }

    return true;
  }

  function safeClick(element, coords = null) {
    if (!element) return;
    try {
      if (typeof element.click === 'function') {
        element.click();
        return;
      }
    } catch (e) {}

    try {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: Number.isFinite(coords?.x) ? coords.x : 0,
        clientY: Number.isFinite(coords?.y) ? coords.y : 0
      });
      element.dispatchEvent(clickEvent);
    } catch (e) {}
  }

  function handlePromotion(pieceChar) {
    const promoWindow = document.querySelector('.promotion-menu, .promotion-window, cg-board ~ .promotion');
    if (!promoWindow) return;

    const pieceLower = pieceChar.toLowerCase();
    const selectors = [
      `.promotion-piece.${pieceLower}`,
      `[data-piece$="${pieceLower}"]`,
      `.promotion-component .${pieceLower}`,
      `square.${pieceLower}`
    ];

    let targetPiece = null;
    for (const s of selectors) {
      targetPiece = document.querySelector(s);
      if (targetPiece) break;
    }

    if (targetPiece) {
      targetPiece.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      targetPiece.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      safeClick(targetPiece);
    }
  }

  /**
   * Autoplay scheduler loop with stealth humanization
   */
  async function autoplayLoop() {
    if (!settings.autoplay) return;
    if (isAutoPlaying) return;

    const currentFEN = generateFEN();
    if (!currentFEN) return;

    const activeColor = currentFEN.split(' ')[1];
    const playerColor = getPlayerColor();

    if (activeColor !== playerColor) {
      lastFEN = '';
      return;
    }

    if (currentFEN === lastFEN) return;

    isAutoPlaying = true;
    lastFEN = currentFEN;

    try {
      let baseDelay = settings.delay || 1100;
      
      if (settings.humanize) {
        const pieceCount = countPieces(currentFEN);
        const complexityFactor = pieceCount > 24 ? 1.1 : 0.9;
        const variance = (Math.random() * 0.6 - 0.3) * baseDelay;
        baseDelay = Math.max(350, Math.round((baseDelay + variance) * complexityFactor));
      }

      await sleep(baseDelay);

      if (generateFEN() === currentFEN && settings.autoplay) {
        const bestMove = await fetchBestMove(currentFEN);
        if (bestMove && generateFEN() === currentFEN && settings.autoplay) {
          await executeMove(bestMove);
        }
      }
    } catch (err) {
      console.error('[Grandmaster AI] Scheduler error:', err);
      lastFEN = '';
    } finally {
      isAutoPlaying = false;
    }
  }

  const boardObserver = new MutationObserver(() => {
    if (settings.autoplay) {
      autoplayLoop();
    }
  });

  function initObserver() {
    const board = getBoard();
    if (board) {
      boardObserver.observe(board, { childList: true, subtree: true, attributes: true });
    } else {
      setTimeout(initObserver, 1000);
    }
  }

  initObserver();

  setInterval(() => {
    if (settings.autoplay) {
      autoplayLoop();
    }
  }, 1200);

  /* =========================================================================
   * AD ELIMINATOR
   * ========================================================================= */
  function optimizeWindowLayout() {
    const adSelectors = [
      '#board-layout-ad',
      '.board-layout-ad',
      '#sidebar-ad',
      '.skyscraper-ad-component',
      '.skyscraper-ad-slot',
      '[id^="skyscraper"]',
      '.ad-upgrade-link-monetization-button',
      '[id^="google_ads_iframe"]',
      '.outstream-ima-player',
      'div.ahover',
      '.upo-label',
      '.ad-container',
      '.ad-wrapper',
      '.ads-layout',
      '.ad-banner'
    ];

    let removedAny = false;
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.remove();
        removedAny = true;
      });
    });

    if (removedAny && !window.__chessBoardOptimized) {
      window.__chessBoardOptimized = true;
      window.dispatchEvent(new Event('resize'));
    }
  }

  optimizeWindowLayout();
  setInterval(optimizeWindowLayout, 2000);

  // Global Engine Interface
  window.chessHelperEngine = {
    getFEN: generateFEN,
    fetchBestMove: fetchBestMove,
    executeMove: executeMove,
    getPlayerColor: getPlayerColor,
    getActiveEvaluation: () => activeEvaluation,
    getApiStats: () => apiStats,
    calculateDynamicDepth: calculateDynamicDepth,
    getDepthConfig: () => ENGINE_DEPTH_CONFIG,
    triggerAutoPlay: () => {
      isAutoPlaying = false;
      lastFEN = '';
      autoplayLoop();
    }
  };
})();
