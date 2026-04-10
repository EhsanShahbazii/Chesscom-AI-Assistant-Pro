/**
 * Grandmaster AI Chess Assistant - Opening Book & ECO Detector
 * Developed by Ehsan Shahbazi
 */

(function() {
  const OPENINGS_DB = {
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B00", name: "King's Pawn Opening (1. e4)" },
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "C20", name: "King's Pawn Game (1. e4 e5)" },
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R": { eco: "C40", name: "King's Knight Opening" },
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R": { eco: "C44", name: "Open Game: Normal Position" },
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C60", name: "Ruy Lopez (Spanish Opening)" },
    "r1bqk1nr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1": { eco: "C65", name: "Ruy Lopez: Berlin Defense" },
    "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C65", name: "Ruy Lopez: Berlin Defense" },
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C50", name: "Italian Game (Giuoco Piano)" },
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C55", name: "Two Knights Defense" },
    "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C53", name: "Italian Game: Giuoco Piano" },
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B20", name: "Sicilian Defense (1... c5)" },
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R": { eco: "B27", name: "Sicilian Defense: Open Variation" },
    "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R": { eco: "B30", name: "Sicilian Defense: Old Sicilian" },
    "rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R": { eco: "B90", name: "Sicilian Defense: Najdorf / Dragon" },
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "C00", name: "French Defense" },
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B10", name: "Caro-Kann Defense" },
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B01", name: "Scandinavian Defense" },
    "rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B06", name: "Modern Defense" },
    "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B02", name: "Alekhine's Defense" },
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR": { eco: "A40", name: "Queen's Pawn Opening (1. d4)" },
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR": { eco: "D00", name: "Queen's Pawn Game (1. d4 d5)" },
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR": { eco: "D06", name: "Queen's Gambit" },
    "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR": { eco: "D30", name: "Queen's Gambit Declined (QGD)" },
    "rnbqkbnr/ppp1pppp/8/3P4/8/8/PP1PPPPP/RNBQKBNR": { eco: "D20", name: "Queen's Gambit Accepted (QGA)" },
    "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR": { eco: "D10", name: "Slav Defense" },
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR": { eco: "A45", name: "Indian Defense (1. d4 Nf6)" },
    "rnbqkb1r/pppppp1p/5np1/8/3P4/8/PPP1PPPP/RNBQKBNR": { eco: "E60", name: "King's Indian Defense" },
    "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR": { eco: "E61", name: "King's Indian / Grünfeld" },
    "rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R": { eco: "D85", name: "Grünfeld Defense" },
    "r1bqkb1r/pppp1ppp/2n5/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R": { eco: "C44", name: "Scotch Game" },
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR": { eco: "A10", name: "English Opening (1. c4)" },
    "rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR": { eco: "A02", name: "Bird's Opening (1. f4)" },
    "rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR": { eco: "A00", name: "Polish Opening (1. b4)" },
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R": { eco: "A04", name: "Réti Opening (1. Nf3)" },
    "rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR": { eco: "C21", name: "Center Game" },
    "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR": { eco: "C30", name: "King's Gambit" },
    "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R": { eco: "C60", name: "Ruy Lopez (Spanish)" },
    "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R": { eco: "C42", name: "Petrov's Defense" },
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR": { eco: "B23", name: "Closed Sicilian" },
    "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR": { eco: "B25", name: "Closed Sicilian Defense" },
    "rnbqkb1r/pp2pppp/3p1n2/2p5/3PP3/2N5/PPP2PPP/R1BQKBNR": { eco: "B50", name: "Sicilian: Classical / Dragon" },
    "r1bqkb1r/pp1npppp/3p1n2/2p5/3PP3/2N2N2/PPP2PPP/R1BQKB1R": { eco: "B54", name: "Sicilian Defense: Accelerated Move" },
    "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR": { eco: "B01", name: "Scandinavian Defense" },
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR": { eco: "C25", name: "Vienna Game" },
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R": { eco: "C46", name: "Four Knights Game" }
  };

  window.chessOpenings = {
    identify: function(fen) {
      if (!fen) return null;
      const piecePlacement = fen.split(' ')[0];
      return OPENINGS_DB[piecePlacement] || null;
    }
  };
})();
