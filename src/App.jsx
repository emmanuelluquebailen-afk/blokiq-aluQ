import { useState, useCallback } from "react";

const GRID_SIZE = 6;

const COLORS = [
  { id: 0, hex: "#FF5E8A", dark: "#CC2255", light: "#FF9BBB" },
  { id: 1, hex: "#FF4040", dark: "#CC1010", light: "#FF8888" },
  { id: 2, hex: "#FF7020", dark: "#CC4400", light: "#FFB070" },
  { id: 3, hex: "#F5C800", dark: "#B89000", light: "#FFE866" },
  { id: 4, hex: "#22CC66", dark: "#118844", light: "#77EEA8" },
  { id: 5, hex: "#3399FF", dark: "#1166CC", light: "#88CCFF" },
];

// ── Slide helpers ──────────────────────────────────────────────────────────────
function slideRowLeft(grid, row) {
  const g = grid.map(r => [...r]);
  const first = g[row][0];
  g[row] = [...g[row].slice(1), first];
  return g;
}
function slideRowRight(grid, row) {
  const g = grid.map(r => [...r]);
  const last = g[row][g[row].length - 1];
  g[row] = [last, ...g[row].slice(0, -1)];
  return g;
}
function slideColUp(grid, col) {
  const g = grid.map(r => [...r]);
  const first = g[0][col];
  for (let r = 0; r < GRID_SIZE - 1; r++) g[r][col] = g[r + 1][col];
  g[GRID_SIZE - 1][col] = first;
  return g;
}
function slideColDown(grid, col) {
  const g = grid.map(r => [...r]);
  const last = g[GRID_SIZE - 1][col];
  for (let r = GRID_SIZE - 1; r > 0; r--) g[r][col] = g[r - 1][col];
  g[0][col] = last;
  return g;
}

// ── Generate shuffled-but-solvable grid ────────────────────────────────────────
function generateGrid() {
  let g = COLORS.map((_, i) => Array(GRID_SIZE).fill(i));
  const n = 40 + Math.floor(Math.random() * 40);
  for (let m = 0; m < n; m++) {
    const type = Math.random() < 0.5 ? "row" : "col";
    const idx = Math.floor(Math.random() * GRID_SIZE);
    const dir = Math.random() < 0.5;
    if (type === "row") g = dir ? slideRowLeft(g, idx) : slideRowRight(g, idx);
    else g = dir ? slideColUp(g, idx) : slideColDown(g, idx);
  }
  return g;
}

function checkWin(grid) {
  return grid.every((row, r) => row.every(cell => cell === r));
}

// ── LEGO Block ─────────────────────────────────────────────────────────────────
function LegoBlock({ colorId, flash }) {
  const c = COLORS[colorId];
  return (
    <div style={{
      width: 46, height: 46,
      borderRadius: 7,
      background: c.hex,
      position: "relative",
      overflow: "hidden",
      boxShadow: `inset 0 -4px 0 ${c.dark}88, inset 0 1px 0 ${c.light}88`,
      transition: "transform 0.12s",
      transform: flash ? "scale(0.92)" : "scale(1)",
      flexShrink: 0,
    }}>
      {/* 2×2 studs */}
      <div style={{
        position: "absolute", top: 7, left: 7, right: 7, bottom: 11,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5,
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${c.light}99, ${c.hex})`,
            boxShadow: `inset 0 1px 2px ${c.dark}66, 0 1px 1px ${c.light}44`,
            border: `1px solid ${c.dark}33`,
          }} />
        ))}
      </div>
      {/* Gloss */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "38%",
        background: `linear-gradient(180deg, ${c.light}55 0%, transparent 100%)`,
        borderRadius: "7px 7px 0 0", pointerEvents: "none",
      }} />
    </div>
  );
}

// ── Arrow Button ───────────────────────────────────────────────────────────────
function ArrowBtn({ label, onClick, horizontal }) {
  const [active, setActive] = useState(false);
  return (
    <button
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => { setActive(false); onClick(); }}
      onClick={onClick}
      style={{
        width: horizontal ? 26 : 44,
        height: horizontal ? 44 : 26,
        background: active ? "#E8C54740" : "#ffffff12",
        border: `1px solid ${active ? "#E8C54780" : "#ffffff18"}`,
        borderRadius: 6,
        color: active ? "#E8C547" : "#aaaaaa",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: active ? "scale(0.93)" : "scale(1)",
        transition: "all 0.1s",
        padding: 0,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function Blokiq() {
  const [grid, setGrid] = useState(generateGrid);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [flashRow, setFlashRow] = useState(null);

  const doMove = useCallback((newGrid, rowFlash) => {
    if (won) return;
    setGrid(newGrid);
    setMoves(m => m + 1);
    if (rowFlash !== undefined) {
      setFlashRow(rowFlash);
      setTimeout(() => setFlashRow(null), 130);
    }
    if (checkWin(newGrid)) setTimeout(() => setWon(true), 180);
  }, [won]);

  const reset = () => {
    setGrid(generateGrid());
    setMoves(0);
    setWon(false);
    setFlashRow(null);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(150deg, #0D0D1C 0%, #141428 55%, #0A0A18 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "28px 16px 48px",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      color: "#F5F0E8",
      userSelect: "none",
      WebkitUserSelect: "none",
    }}>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 6, lineHeight: 1 }}>
          BLOK<span style={{ color: "#E8C547" }}>IQ</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: "#555", textTransform: "uppercase", marginTop: 3 }}>
          by aluQ entertainment
        </div>
      </div>

      {/* Moves */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#ffffff0A", padding: "7px 22px",
        borderRadius: 20, border: "1px solid #ffffff10",
        marginBottom: 24,
      }}>
        <span style={{ fontSize: 10, letterSpacing: 3, color: "#666", textTransform: "uppercase" }}>Coups</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#E8C547", minWidth: 32, textAlign: "center" }}>{moves}</span>
      </div>

      {/* Board */}
      <div style={{
        background: "linear-gradient(180deg, #282840, #1E1E34)",
        borderRadius: 18,
        padding: "14px 12px",
        boxShadow: "0 24px 64px #00000090, inset 0 1px 0 #ffffff12",
        border: "1px solid #ffffff0A",
      }}>

        {/* Col up arrows */}
        <div style={{ display: "flex", gap: 4, marginBottom: 4, paddingLeft: 20 }}>
          <div style={{ width: 4 }} />
          {Array.from({ length: GRID_SIZE }, (_, c) => (
            <ArrowBtn key={c} label="▲" onClick={() => doMove(slideColUp(grid, c))} horizontal={false} />
          ))}
        </div>

        {/* Rows */}
        {grid.map((row, r) => (
          <div key={r} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
            {/* Target pip */}
            <div style={{
              width: 10, height: 46, borderRadius: 5,
              background: COLORS[r].hex,
              boxShadow: `0 0 10px ${COLORS[r].hex}88`,
              flexShrink: 0,
              marginRight: 4,
            }} />

            {/* Left arrow */}
            <ArrowBtn label="◄" onClick={() => doMove(slideRowLeft(grid, r), r)} horizontal={true} />

            {/* Blocks */}
            {row.map((cid, c) => (
              <LegoBlock key={c} colorId={cid} flash={flashRow === r} />
            ))}

            {/* Right arrow */}
            <ArrowBtn label="►" onClick={() => doMove(slideRowRight(grid, r), r)} horizontal={true} />
          </div>
        ))}

        {/* Col down arrows */}
        <div style={{ display: "flex", gap: 4, marginTop: 0, paddingLeft: 20 }}>
          <div style={{ width: 4 }} />
          {Array.from({ length: GRID_SIZE }, (_, c) => (
            <ArrowBtn key={c} label="▼" onClick={() => doMove(slideColDown(grid, c))} horizontal={false} />
          ))}
        </div>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: "#444", marginTop: 16, letterSpacing: 1, textAlign: "center" }}>
        Aligne chaque ligne avec sa couleur ◄ ►
      </div>

      {/* Reset */}
      <button onClick={reset} style={{
        marginTop: 20,
        padding: "10px 28px",
        background: "transparent",
        border: "1px solid #ffffff15",
        borderRadius: 10,
        color: "#555",
        fontSize: 11,
        letterSpacing: 3,
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 0.2s",
      }}>
        Nouvelle partie
      </button>

      {/* Win overlay */}
      {won && (
        <div style={{
          position: "fixed", inset: 0,
          background: "#00000090",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: "linear-gradient(145deg, #1A1A30, #2A2A45)",
            border: "1px solid #E8C54740",
            borderRadius: 28,
            padding: "44px 52px",
            textAlign: "center",
            boxShadow: "0 30px 80px #000000AA, 0 0 0 1px #E8C54720",
          }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🏆</div>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: 5, color: "#E8C547" }}>BRAVO !</div>
            <div style={{ fontSize: 15, color: "#666", marginTop: 10, marginBottom: 32, letterSpacing: 1 }}>
              Résolu en <span style={{ color: "#F5F0E8", fontWeight: 700 }}>{moves}</span> coups
            </div>
            <button onClick={reset} style={{
              padding: "14px 44px",
              background: "linear-gradient(135deg, #E8C547, #C8A020)",
              border: "none",
              borderRadius: 14,
              color: "#0D0D1C",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 4,
              cursor: "pointer",
              textTransform: "uppercase",
              boxShadow: "0 4px 20px #E8C54760",
            }}>
              REJOUER
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
