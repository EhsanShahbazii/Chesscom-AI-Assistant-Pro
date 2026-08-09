# Technical Architecture & Multi-Engine Cascade

## Overview
Grandmaster AI Pro utilizes a multi-tiered analysis cascade to provide rapid, depth-accurate move recommendations with minimal latency.

### 1. Position Acquisition (DOM Extraction)
- **Chess.com**: Scrapes `wc-chess-board` or `.board` piece nodes with `square-XY` class coordinates.
- **Lichess.org**: Scrapes `cg-board` translate transforms and translates CSS coordinates to standard 8x8 matrix.
- **FEN Construction**: Converts the 8x8 grid into valid Forsyth-Edwards Notation (FEN) with turn detection.

### 2. Auto-Hybrid Engine Cascade
1. **Syzygy 7-Piece Endgame Tablebase (`https://tablebase.lichess.ovh/standard`)**:
   - Triggered when total piece count $\le 7$.
   - Delivers mathematically exact evaluations (DTM / DTZ / Mate in N).
2. **Lichess Cloud Evaluation Database (`https://lichess.org/api/cloud-eval`)**:
   - Queried for opening book and well-analyzed Grandmaster positions.
   - Evaluated at depth 45–55+ with 0ms engine compute overhead.
3. **Stockfish 16+ Online API (`https://stockfish.online/api/s/v2.php`)**:
   - Live middlegame evaluator with dynamic depth calculation (depth 6–18).
   - Features automatic retry and failover routing.

### 3. Anti-Detection Humanization Engine
- **Micro-Jitter**: Simulates natural hand imprecision by adding randomized coordinate variance inside squares.
- **Multi-Step Bezier Curves**: Dispatches sequential `pointermove` and `mousemove` events across the board.
- **Cognitive Delay Variance**: Modulates move execution speed based on game phase and position complexity ($\pm 30\%$).
