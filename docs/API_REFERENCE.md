# API Reference & Telemetry

## Endpoints Used

### 1. Syzygy Tablebase API
- **Endpoint**: `https://tablebase.lichess.ovh/standard`
- **Method**: `GET`
- **Parameters**: `fen={FEN_STRING}`
- **Response**: Exact move UCI, DTM, DTZ, checkmate boolean.

### 2. Lichess Cloud Evaluation API
- **Endpoint**: `https://lichess.org/api/cloud-eval`
- **Method**: `GET`
- **Parameters**: `fen={FEN_STRING}&multiPv=1`
- **Response**: Depth, Centipawn evaluation, PV line, Mate in N.

### 3. Stockfish Online v2 API
- **Endpoint**: `https://stockfish.online/api/s/v2.php`
- **Method**: `GET`
- **Parameters**: `fen={FEN_STRING}&depth={DEPTH}`
- **Response**: Best move, Centipawn evaluation, Continuation line.
