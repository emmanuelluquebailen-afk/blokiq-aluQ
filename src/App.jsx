import { useState, useEffect, useCallback, useRef } from "react";

const GRID_SIZE = 6;
const EXPERT_TIME = 180;
const LEVEL_MARGINS = [0.25, 0.25, 0.22, 0.22, 0.20, 0.20, 0.15, 0.15, 0.10, 0.10];
const BONUS_TYPES = ["extra_move", "remove_block", "undo_3"];
const BONUS_LABELS = { extra_move: "🎯 +1 Coup", remove_block: "🧹 Retirer un bloc", undo_3: "↩️ Annuler 3 coups" };

const COLORS = [
  { id: 0, hex: "#FF5E8A", dark: "#CC2255", light: "#FF9BBB" },
  { id: 1, hex: "#FF4040", dark: "#CC1010", light: "#FF8888" },
  { id: 2, hex: "#FF7020", dark: "#CC4400", light: "#FFB070" },
  { id: 3, hex: "#F5C800", dark: "#B89000", light: "#FFE866" },
  { id: 4, hex: "#22CC66", dark: "#118844", light: "#77EEA8" },
  { id: 5, hex: "#3399FF", dark: "#1166CC", light: "#88CCFF" },
];

// ── Repositioning: whole row/column circular rotation (arrows) ─────────────────
function slideRowLeft(g, row) { const n=g.map(r=>[...r]); const f=n[row][0]; n[row]=[...n[row].slice(1),f]; return n; }
function slideRowRight(g, row) { const n=g.map(r=>[...r]); const l=n[row][n[row].length-1]; n[row]=[l,...n[row].slice(0,-1)]; return n; }
function slideColUp(g, col) { const n=g.map(r=>[...r]); const f=n[0][col]; for(let r=0;r<GRID_SIZE-1;r++) n[r][col]=n[r+1][col]; n[GRID_SIZE-1][col]=f; return n; }
function slideColDown(g, col) { const n=g.map(r=>[...r]); const l=n[GRID_SIZE-1][col]; for(let r=GRID_SIZE-1;r>0;r--) n[r][col]=n[r-1][col]; n[0][col]=l; return n; }

function formatTime(s) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; }

// ── Generation: start from the "lined up but not yet sent" board (row r is all
// color r), scramble it with random row/column rotations. Reversing exactly
// those rotations gets back to lined-up, then 36 taps clear it — so every
// generated board is guaranteed solvable, and (scramble + 36) is a real,
// reachable move count we use as the baseline for the level's move limit.
function generateGrid(margin) {
  let g = COLORS.map((_,i)=>Array(GRID_SIZE).fill(i));
  const scramble = 40 + Math.floor(Math.random()*40);
  for (let m=0;m<scramble;m++) {
    const type = Math.random()<0.5 ? "row" : "col";
    const idx = Math.floor(Math.random()*GRID_SIZE);
    const dir = Math.random()<0.5;
    if (type==="row") g = dir ? slideRowLeft(g,idx) : slideRowRight(g,idx);
    else g = dir ? slideColUp(g,idx) : slideColDown(g,idx);
  }
  const baseline = scramble + GRID_SIZE*GRID_SIZE; // rotations + the 36 mandatory exits
  return { grid: g, moveLimit: Math.ceil(baseline*(1+margin)), scramble: baseline };
}

// Remove the block at (r,c): everything to its right in that row shifts left,
// the freed slot lands at the row's right end.
function removeFromRow(grid, r, c) {
  const n = grid.map(row=>[...row]);
  const row = n[r];
  n[r] = [...row.slice(0,c), ...row.slice(c+1), null];
  return n;
}

function findBonusBlock(grid) {
  const candidates = [];
  for (let r=0;r<GRID_SIZE;r++) for (let c=0;c<GRID_SIZE;c++) {
    if (grid[r][c] === r) candidates.push({r,c});
  }
  if (candidates.length===0) return null;
  return candidates[Math.floor(Math.random()*candidates.length)];
}

function randomBonus() { return BONUS_TYPES[Math.floor(Math.random()*BONUS_TYPES.length)]; }

// ── Components ───────────────────────────────────────────────────────────────
function LegoBlock({ colorId, eligible, exiting, onTap }) {
  const c = COLORS[colorId];
  return (
    <button onClick={onTap}
      onTouchEnd={(e)=>{ e.preventDefault(); onTap(); }}
      style={{ width:"var(--blk)",height:"var(--blk)",borderRadius:7,background:c.hex,position:"relative",overflow:"hidden",
        border: eligible ? "2px solid #ffffffcc" : "2px solid transparent",
        boxShadow: exiting ? `0 0 22px ${c.hex}` : (eligible ? `0 0 12px #ffffff66, inset 0 -4px 0 ${c.dark}88` : `inset 0 -4px 0 ${c.dark}88, inset 0 1px 0 ${c.light}88`),
        transform: exiting ? "scale(1.3)" : "scale(1)",
        opacity: exiting ? 0 : 1,
        transition: "transform 0.25s ease, opacity 0.25s ease, box-shadow 0.2s ease",
        padding:0, cursor:"pointer", touchAction:"manipulation", flexShrink:0 }}>
      <div style={{ position:"absolute",top:"15%",left:"15%",right:"15%",bottom:"24%",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"11%" }}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{ borderRadius:"50%",
            background:`radial-gradient(circle at 35% 35%, ${c.light}99, ${c.hex})`,
            boxShadow:`inset 0 1px 2px ${c.dark}66`, border:`1px solid ${c.dark}33` }} />
        ))}
      </div>
      <div style={{ position:"absolute",top:0,left:0,right:0,height:"38%",
        background:`linear-gradient(180deg, ${c.light}55 0%, transparent 100%)`,
        borderRadius:"7px 7px 0 0",pointerEvents:"none" }} />
    </button>
  );
}

function EmptySlot() {
  return <div style={{ width:"var(--blk)",height:"var(--blk)",borderRadius:7,
    border:"1.5px dashed #ffffff14", background:"#ffffff05", flexShrink:0 }} />;
}

function ArrowBtn({ label, onClick, horizontal, disabled }) {
  const [active, setActive] = useState(false);
  return (
    <button disabled={disabled}
      onMouseDown={()=>setActive(true)} onMouseUp={()=>setActive(false)} onMouseLeave={()=>setActive(false)}
      onTouchStart={()=>setActive(true)}
      onTouchEnd={(e)=>{ e.preventDefault(); setActive(false); if(!disabled) onClick(); }}
      onClick={onClick}
      style={{ width:horizontal?"calc(var(--blk) * 0.565)":"var(--blk)",
        height:horizontal?"var(--blk)":"calc(var(--blk) * 0.565)",
        background:active?"#E8C54740":"#ffffff12", border:`1px solid ${active?"#E8C54780":"#ffffff18"}`,
        borderRadius:6, color:disabled?"#333":(active?"#E8C547":"#aaaaaa"), fontSize:11, fontWeight:700,
        cursor:disabled?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        transform:active?"scale(0.93)":"scale(1)", transition:"all 0.1s", padding:0, flexShrink:0,
        opacity:disabled?0.25:1, touchAction:"manipulation" }}>
      {label}
    </button>
  );
}

function Overlay({ children }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"#00000090",backdropFilter:"blur(6px)",
      WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}>
      <div style={{ background:"linear-gradient(145deg, #1A1A30, #2A2A45)",border:"1px solid #ffffff15",
        borderRadius:28,padding:"40px 48px",textAlign:"center",boxShadow:"0 30px 80px #000000AA",
        maxWidth:340,width:"90%" }}>
        {children}
      </div>
    </div>
  );
}

function OBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"12px 24px",
      background:`linear-gradient(135deg, ${color}, ${color}CC)`, border:"none", borderRadius:14,
      color:"#0D0D1C", fontSize:11, fontWeight:900, letterSpacing:3, cursor:"pointer",
      textTransform:"uppercase" }}>
      {label}
    </button>
  );
}

// ── Menu ───────────────────────────────────────────────────────────────────────
function Menu({ onStart, expertUnlocked }) {
  return (
    <div style={{ minHeight:"100dvh", width:"100%", boxSizing:"border-box", overflowX:"hidden",
      background:"linear-gradient(150deg, #0D0D1C 0%, #141428 55%, #0A0A18 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:"40px 24px", fontFamily:"'Segoe UI', system-ui, sans-serif", color:"#F5F0E8" }}>
      <style>{`*{box-sizing:border-box} html,body{margin:0;overflow-x:hidden;background:#0D0D1C;min-height:100%}`}</style>
      <div style={{ fontSize:52,fontWeight:900,letterSpacing:6,lineHeight:1,marginBottom:6 }}>
        BLOK<span style={{ color:"#E8C547" }}>IQ</span>
      </div>
      <div style={{ fontSize:10,letterSpacing:4,color:"#555",textTransform:"uppercase",marginBottom:52 }}>
        by aluQ entertainment
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:14,width:"100%",maxWidth:340 }}>
        <button onClick={()=>onStart("normal")} style={{ background:"linear-gradient(135deg, #1E1E34, #282844)",
          border:"1px solid #3399FF44",borderRadius:18,padding:"24px",cursor:"pointer",textAlign:"left",
          boxShadow:"0 8px 32px #3399FF18" }}>
          <div style={{ fontSize:10,letterSpacing:3,color:"#3399FF",textTransform:"uppercase",marginBottom:6 }}>Mode</div>
          <div style={{ fontSize:24,fontWeight:900,color:"#F5F0E8",letterSpacing:2,marginBottom:10 }}>NORMAL</div>
          <div style={{ fontSize:12,color:"#666",lineHeight:1.7 }}>
            ✦ 10 niveaux progressifs<br/>
            ✦ Marge de coups décroissante<br/>
            ✦ Bonus toutes les 2 manches
          </div>
        </button>
        <button onClick={()=>expertUnlocked && onStart("expert")} style={{
          background:"linear-gradient(135deg, #1E1E34, #282844)",
          border:`1px solid ${expertUnlocked?"#FF5E8A44":"#333344"}`,
          borderRadius:18,padding:"24px",cursor:expertUnlocked?"pointer":"default",textAlign:"left",
          boxShadow:expertUnlocked?"0 8px 32px #FF5E8A18":"none",
          opacity:expertUnlocked?1:0.5 }}>
          <div style={{ fontSize:10,letterSpacing:3,color:expertUnlocked?"#FF5E8A":"#555",textTransform:"uppercase",marginBottom:6 }}>Mode</div>
          <div style={{ fontSize:24,fontWeight:900,color:"#F5F0E8",letterSpacing:2,marginBottom:10 }}>
            EXPERT {!expertUnlocked && <span style={{ fontSize:14,color:"#555" }}>🔒</span>}
          </div>
          <div style={{ fontSize:12,color:"#666",lineHeight:1.7 }}>
            ✦ Coups limités (+10%)<br/>
            ✦ Compte à rebours 3 minutes<br/>
            {expertUnlocked ? "✦ Mode débloqué !" : "✦ Terminer les 10 niveaux Normal"}
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function Blokiq() {
  const [screen, setScreen] = useState("menu");
  const [mode, setMode] = useState("normal");
  const [level, setLevel] = useState(0);
  const [grid, setGrid] = useState(null);
  const [moveLimit, setMoveLimit] = useState(0);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState([]);
  const [retryAvailable, setRetryAvailable] = useState(true);
  const [currentMargin, setCurrentMargin] = useState(0);
  const [bonuses, setBonuses] = useState([]);
  const [levelsWon, setLevelsWon] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXPERT_TIME);
  const [gameStatus, setGameStatus] = useState("playing");
  const [expertUnlocked, setExpertUnlocked] = useState(() => localStorage.getItem("blokiq_expert") === "1");
  const [showBonus, setShowBonus] = useState(null);
  const timerRef = useRef(null);

  const loadLevel = useCallback((lvl, margin, retryFlag=true) => {
    const { grid: g, moveLimit: ml } = generateGrid(margin);
    setLevel(lvl);
    setCurrentMargin(margin);
    setGrid(g);
    setMoveLimit(ml);
    setMoves(0);
    setHistory([]);
    setRetryAvailable(retryFlag);
    setTimeLeft(EXPERT_TIME);
    setGameStatus("playing");
  }, []);

  const startGame = useCallback((selectedMode) => {
    setMode(selectedMode);
    setBonuses([]);
    setLevelsWon(0);
    if (selectedMode === "normal") loadLevel(0, LEVEL_MARGINS[0]);
    else loadLevel(0, 0.10);
    setScreen("game");
  }, [loadLevel]);

  useEffect(() => {
    if (screen !== "game" || mode !== "expert" || gameStatus !== "playing") {
      clearInterval(timerRef.current); return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t<=1){ clearInterval(timerRef.current); setGameStatus("lost"); return 0; } return t-1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, mode, gameStatus]);

  const remainingBlocks = grid ? grid.flat().filter(v=>v!==null).length : 36;

  // Every mutation (arrow reposition OR tap-to-exit) goes through this single
  // path. It reads the grid via the FUNCTIONAL setGrid form, so even if two
  // taps land within the same render tick, the second always sees the result
  // of the first — no race, no "blocks coming back".
  const applyMutation = useCallback((computeFn) => {
    if (gameStatus !== "playing") return;
    setGrid(currentGrid => {
      const newGrid = computeFn(currentGrid);
      if (newGrid === currentGrid) return currentGrid; // no-op, nothing changed
      setHistory(h => [currentGrid.map(row=>[...row]), ...h].slice(0,3));
      setMoves(m => {
        const newMoves = m + 1;
        const remaining = newGrid.flat().filter(v=>v!==null).length;
        if (remaining === 0) { clearInterval(timerRef.current); setGameStatus("won"); }
        else if (newMoves >= moveLimit) { setGameStatus("lost"); }
        return newMoves;
      });
      return newGrid;
    });
  }, [gameStatus, moveLimit]);

  // Row/column repositioning arrows
  const makeMove = useCallback((dirFn) => { applyMutation(dirFn); }, [applyMutation]);

  // Tap a block: if it's already sitting in its own matching row, it exits
  // immediately and the rest of that row shifts left to close the gap.
  const tapBlock = useCallback((r, c) => {
    applyMutation(currentGrid => {
      const colorId = currentGrid[r][c];
      if (colorId === null || colorId !== r) return currentGrid; // not eligible
      return removeFromRow(currentGrid, r, c);
    });
  }, [applyMutation]);

  const useBonus = useCallback((type, fromRetry=false) => {
    setBonuses(b => { const idx=b.indexOf(type); if (idx===-1) return b; return [...b.slice(0,idx), ...b.slice(idx+1)]; });
    if (type === "extra_move") {
      setMoveLimit(ml => ml + 1);
    } else if (type === "remove_block") {
      setGrid(currentGrid => {
        const target = findBonusBlock(currentGrid);
        if (!target) return currentGrid;
        const ng = removeFromRow(currentGrid, target.r, target.c);
        const remaining = ng.flat().filter(v=>v!==null).length;
        if (remaining === 0) { clearInterval(timerRef.current); setGameStatus(s=> s==="playing"?"won":s); }
        return ng;
      });
    } else if (type === "undo_3") {
      setHistory(h => {
        if (h.length > 0) {
          const target = h[Math.min(2, h.length-1)];
          setGrid(target);
          setMoves(m => Math.max(0, m - h.length));
          return [];
        }
        return h;
      });
    }
    if (fromRetry) setRetryAvailable(true);
  }, []);

  const handleWin = useCallback(() => {
    const newLevelsWon = levelsWon + 1;
    setLevelsWon(newLevelsWon);
    if (newLevelsWon % 2 === 0) {
      const b = randomBonus();
      setBonuses(bs => [...bs, b]);
      setShowBonus(b);
      setTimeout(() => setShowBonus(null), 2500);
    }
    if (mode === "normal" && level === 9) {
      localStorage.setItem("blokiq_expert", "1");
      setExpertUnlocked(true);
    }
  }, [levelsWon, mode, level]);

  useEffect(() => { if (gameStatus === "won") handleWin(); }, [gameStatus]);

  const goNextLevel = useCallback(() => {
    if (mode === "normal") {
      const nextLevel = level + 1;
      if (nextLevel >= 10) { setScreen("menu"); return; }
      loadLevel(nextLevel, LEVEL_MARGINS[nextLevel]);
    } else loadLevel(0, 0.10);
  }, [mode, level, loadLevel]);

  const handleRetry = useCallback(() => {
    const reducedMargin = Math.max(0.10, currentMargin - 0.01);
    loadLevel(level, reducedMargin, false);
  }, [level, currentMargin, loadLevel]);

  const handleLost = useCallback(() => {
    if (retryAvailable) return;
    if (bonuses.length > 0) {
      const b = bonuses[0];
      useBonus(b, true);
      loadLevel(level, currentMargin, false);
    } else setGameStatus("gameover");
  }, [retryAvailable, bonuses, useBonus, level, currentMargin, loadLevel]);

  const disabled = gameStatus !== "playing";
  const movesLeft = moveLimit - moves;
  const timerDanger = mode === "expert" && timeLeft <= 30;

  if (screen === "menu") return <Menu onStart={startGame} expertUnlocked={expertUnlocked} />;

  return (
    <div style={{ minHeight:"100dvh", width:"100%", boxSizing:"border-box", overflowX:"hidden",
      "--blk": "min(46px, calc((100vw - 100px) / 7.2))",
      background:"linear-gradient(150deg, #0D0D1C 0%, #141428 55%, #0A0A18 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:"16px 12px 48px",
      fontFamily:"'Segoe UI', system-ui, sans-serif",
      color:"#F5F0E8",userSelect:"none",WebkitUserSelect:"none" }}>

      <style>{`*{box-sizing:border-box} html,body{margin:0;overflow-x:hidden;background:#0D0D1C;min-height:100%}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ textAlign:"center",marginBottom:4 }}>
        <div style={{ fontSize:36,fontWeight:900,letterSpacing:6,lineHeight:1 }}>
          BLOK<span style={{ color:"#E8C547" }}>IQ</span>
        </div>
        <div style={{ fontSize:9,letterSpacing:4,color:"#555",textTransform:"uppercase",marginTop:2 }}>
          by aluQ entertainment
        </div>
      </div>

      {mode === "normal" && (
        <div style={{ display:"flex",gap:6,marginBottom:8,marginTop:4 }}>
          {Array.from({length:10},(_,i)=>(
            <div key={i} style={{ width:20,height:4,borderRadius:2,
              background: i < level ? "#22CC66" : i === level ? "#E8C547" : "#ffffff15" }} />
          ))}
        </div>
      )}

      <div style={{ display:"flex",alignItems:"center",gap:14,
        background:"#ffffff0A",padding:"7px 18px",borderRadius:20,
        border:"1px solid #ffffff10",marginBottom:14,flexWrap:"wrap",justifyContent:"center" }}>
        <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",fontWeight:700,
          color:mode==="expert"?"#FF5E8A":"#3399FF",padding:"3px 10px",borderRadius:10,
          background:mode==="expert"?"#FF5E8A18":"#3399FF18",
          border:`1px solid ${mode==="expert"?"#FF5E8A44":"#3399FF44"}` }}>
          {mode === "normal" ? `NV. ${level+1}/10` : "EXPERT"}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <span style={{ fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>Coups</span>
          <span style={{ fontSize:19,fontWeight:800,color:movesLeft<=4?"#FF4040":"#E8C547" }}>{movesLeft}</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <span style={{ fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>Restants</span>
          <span style={{ fontSize:19,fontWeight:800,color:"#22CC66" }}>{remainingBlocks}</span>
        </div>
        {mode === "expert" && (
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>Temps</span>
            <span style={{ fontSize:19,fontWeight:800,
              color:timerDanger?"#FF4040":"#F5F0E8",
              animation:timerDanger?"pulse 0.6s ease-in-out infinite":"none" }}>{formatTime(timeLeft)}</span>
          </div>
        )}
        {bonuses.length > 0 && <div style={{ fontSize:10,color:"#E8C547" }}>🎁 ×{bonuses.length}</div>}
      </div>

      {/* Board */}
      <div style={{ background:"linear-gradient(180deg, #282840, #1E1E34)",borderRadius:18,
        padding:"10px 8px",boxShadow:"0 24px 64px #00000090, inset 0 1px 0 #ffffff12",
        border:"1px solid #ffffff0A", maxWidth:"100%" }}>
        <div style={{ display:"flex",gap:4,marginBottom:4,paddingLeft:"calc(22px + var(--blk) * 0.565)" }}>
          {Array.from({length:GRID_SIZE},(_,c)=>(
            <ArrowBtn key={c} label="▲" disabled={disabled} onClick={()=>makeMove(g=>slideColUp(g,c))} horizontal={false} />
          ))}
        </div>

        {grid && grid.map((row,r)=>(
          <div key={r} style={{ display:"flex",gap:4,alignItems:"center",marginBottom:4 }}>
            <div style={{ width:10,height:"var(--blk)",borderRadius:5,background:COLORS[r].hex,
              boxShadow:`0 0 10px ${COLORS[r].hex}88`,flexShrink:0,marginRight:4 }} />
            <ArrowBtn label="◄" disabled={disabled} onClick={()=>makeMove(g=>slideRowLeft(g,r))} horizontal={true} />
            {row.map((cid,c)=> cid===null
              ? <EmptySlot key={c} />
              : <LegoBlock key={c} colorId={cid}
                  eligible={cid===r}
                  exiting={false}
                  onTap={()=>tapBlock(r,c)} />
            )}
            <ArrowBtn label="►" disabled={disabled} onClick={()=>makeMove(g=>slideRowRight(g,r))} horizontal={true} />
          </div>
        ))}

        <div style={{ display:"flex",gap:4,paddingLeft:"calc(22px + var(--blk) * 0.565)" }}>
          {Array.from({length:GRID_SIZE},(_,c)=>(
            <ArrowBtn key={c} label="▼" disabled={disabled} onClick={()=>makeMove(g=>slideColDown(g,c))} horizontal={false} />
          ))}
        </div>
      </div>

      {bonuses.length > 0 && gameStatus === "playing" && (
        <div style={{ display:"flex",gap:8,marginTop:12,flexWrap:"wrap",justifyContent:"center" }}>
          {[...new Set(bonuses)].map(b=>(
            <button key={b} onClick={()=>useBonus(b)} style={{ padding:"7px 14px",
              background:"#E8C54715",border:"1px solid #E8C54744",borderRadius:10,
              color:"#E8C547",fontSize:11,cursor:"pointer",letterSpacing:1 }}>
              {BONUS_LABELS[b]}
            </button>
          ))}
        </div>
      )}

      <div style={{ fontSize:10,color:"#444",marginTop:12,letterSpacing:1,textAlign:"center" }}>
        Touche un bloc surligné pour l'envoyer · les flèches repositionnent
      </div>
      <button onClick={()=>setScreen("menu")} style={{ marginTop:10,padding:"6px 20px",
        background:"transparent",border:"1px solid #ffffff0D",borderRadius:10,
        color:"#333",fontSize:9,letterSpacing:3,textTransform:"uppercase",cursor:"pointer" }}>
        Menu
      </button>

      {showBonus && (
        <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",
          background:"#1A1A30",border:"1px solid #E8C54760",borderRadius:14,
          padding:"12px 24px",fontSize:13,color:"#E8C547",zIndex:200,
          boxShadow:"0 8px 32px #00000088",textAlign:"center" }}>
          Bonus gagné !<br/><span style={{ fontSize:15 }}>{BONUS_LABELS[showBonus]}</span>
        </div>
      )}

      {gameStatus === "won" && (
        <Overlay>
          <div style={{ fontSize:48,marginBottom:8 }}>🏆</div>
          <div style={{ fontSize:34,fontWeight:900,letterSpacing:5,color:"#E8C547" }}>BRAVO !</div>
          <div style={{ fontSize:13,color:"#666",marginTop:8,marginBottom:8 }}>
            Niveau {level+1} · {moves} coups
            {mode==="expert" && ` · ${formatTime(EXPERT_TIME-timeLeft)}`}
          </div>
          {mode==="normal" && level===9 && (
            <div style={{ fontSize:12,color:"#FF5E8A",marginBottom:12,letterSpacing:1 }}>🎉 Mode Expert débloqué !</div>
          )}
          <div style={{ display:"flex",gap:10,justifyContent:"center",marginTop:20 }}>
            {mode==="normal" && level<9
              ? <OBtn label="SUIVANT →" color="#E8C547" onClick={goNextLevel} />
              : <OBtn label="REJOUER" color="#E8C547" onClick={()=>startGame(mode)} />}
            <OBtn label="MENU" color="#3399FF" onClick={()=>setScreen("menu")} />
          </div>
        </Overlay>
      )}

      {gameStatus === "lost" && (
        <Overlay>
          <div style={{ fontSize:48,marginBottom:8 }}>😤</div>
          <div style={{ fontSize:28,fontWeight:900,letterSpacing:4,color:"#FF4040" }}>
            {movesLeft <= 0 ? "Plus de coups !" : "Temps écoulé !"}
          </div>
          <div style={{ fontSize:12,color:"#555",marginTop:8,marginBottom:20 }}>
            {retryAvailable
              ? `Marge réduite de 1% — ${bonuses.length} bonus disponible${bonuses.length>1?"s":""}`
              : bonuses.length > 0
                ? `Bonus "${BONUS_LABELS[bonuses[0]]}" utilisé automatiquement`
                : "Aucun bonus disponible"}
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" }}>
            {retryAvailable && <OBtn label="RETRY −1%" color="#FF7020" onClick={handleRetry} />}
            {!retryAvailable && bonuses.length > 0 && <OBtn label="UTILISER BONUS" color="#E8C547" onClick={handleLost} />}
            {(!retryAvailable && bonuses.length === 0) && <OBtn label="GAME OVER" color="#FF4040" onClick={()=>setGameStatus("gameover")} />}
            <OBtn label="MENU" color="#3399FF" onClick={()=>setScreen("menu")} />
          </div>
        </Overlay>
      )}

      {gameStatus === "gameover" && (
        <Overlay>
          <div style={{ fontSize:48,marginBottom:8 }}>💀</div>
          <div style={{ fontSize:28,fontWeight:900,letterSpacing:4,color:"#FF4040" }}>GAME OVER</div>
          <div style={{ fontSize:12,color:"#555",marginTop:8,marginBottom:24,lineHeight:1.7 }}>
            Plus de retry ni de bonus.<br/>La campagne recommence depuis le début.
          </div>
          <OBtn label="RECOMMENCER" color="#FF4040" onClick={()=>startGame("normal")} />
        </Overlay>
      )}
    </div>
  );
}
