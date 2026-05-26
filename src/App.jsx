import { useState, useCallback, useMemo } from "react";

const ROWS = 9;
const COLS = 9;
const HEX = 26;

// ── Hex math (pointy-top, odd-r offset) ──
function toCube(r, c) {
  const x = c - (r - (r & 1)) / 2;
  const z = r;
  return { x, y: -x - z, z };
}
function toOffset(x, _y, z) {
  return { r: z, c: x + (z - (z & 1)) / 2 };
}
function cubeDist(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}
function hexXY(r, c) {
  const w = Math.sqrt(3) * HEX;
  return {
    x: w * c + (r & 1 ? w / 2 : 0) + w * 0.75,
    y: 2 * HEX * 0.75 * r + HEX * 0.9,
  };
}
function hexPts(cx, cy, s) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`;
  }).join(" ");
}

const CUBE_DIRS = [
  { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 },
];

function adjacent(r, c) {
  const cu = toCube(r, c);
  return CUBE_DIRS.map(d => toOffset(cu.x + d.x, cu.y + d.y, cu.z + d.z))
    .filter(p => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS);
}

function reachable(board, r, c) {
  const cu = toCube(r, c);
  const splits = [], leaps = [];
  for (let rr = 0; rr < ROWS; rr++)
    for (let cc = 0; cc < COLS; cc++) {
      if (board[rr][cc] !== 0) continue;
      const d = cubeDist(cu, toCube(rr, cc));
      if (d === 1) splits.push({ r: rr, c: cc, type: "split" });
      else if (d === 2) leaps.push({ r: rr, c: cc, type: "leap" });
    }
  return [...splits, ...leaps];
}

function doMove(board, fr, fc, tr, tc, player) {
  const nb = board.map(r => [...r]);
  const d = cubeDist(toCube(fr, fc), toCube(tr, tc));
  if (d > 1) nb[fr][fc] = 0;
  nb[tr][tc] = player;
  const opp = 3 - player;
  const flipped = [];
  for (const { r, c } of adjacent(tr, tc)) {
    if (nb[r][c] === opp) { nb[r][c] = player; flipped.push(`${r}-${c}`); }
  }
  return { board: nb, flipped };
}

function canPlay(board, player) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === player && reachable(board, r, c).length > 0) return true;
  return false;
}

function count(board) {
  let a = 0, b = 0;
  board.forEach(row => row.forEach(v => { if (v === 1) a++; if (v === 2) b++; }));
  return [a, b];
}

const svgW = (() => {
  let mx = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const { x } = hexXY(r, c);
    if (x + HEX > mx) mx = x + HEX;
  }
  return mx + HEX * 0.75;
})();
const svgH = (() => {
  let my = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const { y } = hexXY(r, c);
    if (y + HEX > my) my = y + HEX;
  }
  return my + HEX * 0.5;
})();

const P = {
  1: { fill: "#0b3d2e", stroke: "#00e8a2", glow: "#00e8a2", piece: "#00ffb0" },
  2: { fill: "#3d0b2e", stroke: "#e800a2", glow: "#e800a2", piece: "#ff60d0" },
};

function initBoard() {
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  b[0][0] = 1; b[1][0] = 1;
  b[ROWS - 1][COLS - 1] = 2; b[ROWS - 2][COLS - 1] = 2;
  return b;
}

export default function Overgrow() {
  const [screen, setScreen] = useState("menu");
  const [board, setBoard] = useState(initBoard);
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState(null);
  const [moves, setMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [flippedCells, setFlippedCells] = useState([]);
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [p1Name, setP1Name] = useState("JADE");
  const [p2Name, setP2Name] = useState("ROSE");
  const [busy, setBusy] = useState(false);

  const scores = useMemo(() => count(board), [board]);

  const reset = useCallback(() => {
    setBoard(initBoard());
    setTurn(1);
    setSel(null);
    setMoves([]);
    setLastMove(null);
    setFlippedCells([]);
    setHistory([]);
    setGameOver(null);
    setMoveCount(0);
    setBusy(false);
  }, []);

  const selectCell = useCallback((r, c) => {
    if (gameOver || busy) return;

    const moveTarget = moves.find(m => m.r === r && m.c === c);
    if (moveTarget && sel) {
      setBusy(true);
      const result = doMove(board, sel.r, sel.c, r, c, turn);
      setHistory(h => [...h, { board: board.map(r => [...r]), turn }]);
      setBoard(result.board);
      setLastMove({ r, c });
      setFlippedCells(result.flipped);
      setSel(null);
      setMoves([]);
      setMoveCount(mc => mc + 1);

      const next = 3 - turn;
      setTimeout(() => {
        setFlippedCells([]);
        if (canPlay(result.board, next)) {
          setTurn(next);
        } else if (canPlay(result.board, turn)) {
          // skip
        } else {
          const [a, b] = count(result.board);
          setGameOver(a > b ? 1 : b > a ? 2 : 0);
        }
        setBusy(false);
      }, 450);
      return;
    }

    if (board[r][c] === turn) {
      const m = reachable(board, r, c);
      if (m.length > 0) {
        setSel({ r, c });
        setMoves(m);
      }
      return;
    }

    setSel(null);
    setMoves([]);
  }, [board, turn, sel, moves, gameOver, busy]);

  const undo = useCallback(() => {
    if (history.length === 0 || busy) return;
    const prev = history[history.length - 1];
    setBoard(prev.board);
    setTurn(prev.turn);
    setHistory(h => h.slice(0, -1));
    setSel(null);
    setMoves([]);
    setLastMove(null);
    setFlippedCells([]);
    setGameOver(null);
    setMoveCount(mc => mc - 1);
  }, [history, busy]);

  // ── MENU ──
  if (screen === "menu") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a14",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff", padding: 20,
      }}>
        <style>{`
          @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
          @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
          .mbtn{background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #2a2a4a;color:#fff;padding:16px 52px;border-radius:50px;font-size:17px;font-weight:700;cursor:pointer;letter-spacing:4px;transition:all .3s;text-transform:uppercase}
          .mbtn:hover{border-color:#00e8a2;box-shadow:0 0 30px #00e8a220;transform:translateY(-2px)}
          .ninp{background:#12121e;border:1px solid #2a2a4a;color:#fff;padding:10px 14px;border-radius:12px;font-size:15px;text-align:center;width:130px;outline:none;font-weight:700;letter-spacing:2px;transition:border-color .3s}
          .ninp:focus{border-color:#00e8a2}
          .ninp.p2:focus{border-color:#e800a2}
        `}</style>

        <div style={{ animation: "float 3s ease-in-out infinite", marginBottom: 12 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <defs>
              <radialGradient id="mg1" cx="38%" cy="38%"><stop offset="0%" stopColor="#00ffb0"/><stop offset="100%" stopColor="#009966"/></radialGradient>
              <radialGradient id="mg2" cx="38%" cy="38%"><stop offset="0%" stopColor="#ff60d0"/><stop offset="100%" stopColor="#990066"/></radialGradient>
            </defs>
            <circle cx="26" cy="32" r="15" fill="url(#mg1)" opacity=".85"/>
            <circle cx="46" cy="32" r="15" fill="url(#mg2)" opacity=".85"/>
            <circle cx="36" cy="46" r="9" fill="#00e8a2" opacity=".35"/>
            <circle cx="36" cy="46" r="9" fill="#e800a2" opacity=".35"/>
          </svg>
        </div>

        <h1 style={{
          fontSize: 50, fontWeight: 800, letterSpacing: 14, margin: "0 0 2px",
          background: "linear-gradient(135deg,#00e8a2,#e800a2)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>OVERGROW</h1>
        <p style={{ color: "#4a4a6a", fontSize: 12, letterSpacing: 5, marginBottom: 36, textTransform: "uppercase" }}>
          Grow • Convert • Dominate
        </p>

        <div style={{ display: "flex", gap: 28, marginBottom: 32, animation: "fadeUp .7s ease-out .15s both" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#00e8a2", letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Player 1</div>
            <input className="ninp" value={p1Name} maxLength={8} onChange={e => setP1Name(e.target.value.toUpperCase())}/>
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#00ffb0", margin: "10px auto 0", boxShadow: "0 0 10px #00e8a2" }}/>
          </div>
          <div style={{ color: "#2a2a4a", fontSize: 18, alignSelf: "center", paddingTop: 10 }}>vs</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#e800a2", letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Player 2</div>
            <input className="ninp p2" value={p2Name} maxLength={8} onChange={e => setP2Name(e.target.value.toUpperCase())}/>
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff60d0", margin: "10px auto 0", boxShadow: "0 0 10px #e800a2" }}/>
          </div>
        </div>

        <button className="mbtn" onClick={() => { reset(); setScreen("game"); }}
          style={{ animation: "fadeUp .7s ease-out .3s both", marginBottom: 40 }}>
          Play
        </button>

        <div style={{ maxWidth: 420, animation: "fadeUp .7s ease-out .5s both" }}>
          <div style={{ fontSize: 10, color: "#3a3a5a", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase", textAlign: "center" }}>How it Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "◎", t: "Select", d: "Tap one of your cells" },
              { icon: "✦", t: "Split", d: "Move 1 hex → clone yourself" },
              { icon: "⟶", t: "Leap", d: "Jump 2 hexes → you move there" },
              { icon: "⟲", t: "Convert", d: "Enemy neighbors become yours" },
            ].map((x, i) => (
              <div key={i} style={{
                background: "#0e0e1a", borderRadius: 12, padding: "11px 12px",
                border: "1px solid #1a1a2e",
              }}>
                <span style={{ fontSize: 16, marginRight: 8 }}>{x.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#7a7a9a" }}>{x.t}</span>
                <div style={{ fontSize: 10, color: "#3a3a5a", marginTop: 3, paddingLeft: 26 }}>{x.d}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#2a2a4a", lineHeight: 1.6 }}>
            Board fills up → most cells wins.
            <br/>One well-placed leap can flip half the board!
          </div>
        </div>
      </div>
    );
  }

  // ── GAME ──
  const names = { 1: p1Name || "P1", 2: p2Name || "P2" };
  const total = ROWS * COLS;
  const bar1 = scores[0] / total * 100;
  const bar2 = scores[1] / total * 100;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a14",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#fff",
      padding: "10px 6px 20px", userSelect: "none",
    }}>
      <style>{`
        @keyframes popIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes flipC{0%{transform:scale(1)}50%{transform:scale(.2)}100%{transform:scale(1)}}
        @keyframes ringP{0%,100%{opacity:.5}50%{opacity:.15}}
        @keyframes hexG{0%,100%{opacity:.12}50%{opacity:.45}}
        @keyframes bounce{0%{transform:scale(.4)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideBar{from{width:0}to{width:100%}}
      `}</style>

      {/* Scoreboard */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", maxWidth: svgW + 16, padding: "0 4px", marginBottom: 6,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 14,
          background: turn === 1 && !gameOver ? "#0b3d2e25" : "transparent",
          border: `1px solid ${turn === 1 && !gameOver ? "#00e8a230" : "transparent"}`,
          transition: "all .35s",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%,#00ffb0,#007755)",
            boxShadow: turn === 1 ? "0 0 14px #00e8a250" : "none",
            transition: "box-shadow .35s",
          }}/>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#00e8a2", fontWeight: 700 }}>{names[1]}</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{scores[0]}</div>
          </div>
        </div>

        <div style={{ textAlign: "center", minWidth: 80 }}>
          {gameOver !== null ? (
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#6a6a8a", textTransform: "uppercase" }}>Finished</div>
          ) : (
            <>
              <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a3a5a", textTransform: "uppercase" }}>Turn {moveCount + 1}</div>
              <div style={{
                fontSize: 11, letterSpacing: 2, fontWeight: 700,
                color: P[turn].stroke, transition: "color .3s",
              }}>{names[turn]}'s move</div>
            </>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse",
          padding: "7px 14px", borderRadius: 14,
          background: turn === 2 && !gameOver ? "#3d0b2e25" : "transparent",
          border: `1px solid ${turn === 2 && !gameOver ? "#e800a230" : "transparent"}`,
          transition: "all .35s",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%,#ff60d0,#990066)",
            boxShadow: turn === 2 ? "0 0 14px #e800a250" : "none",
            transition: "box-shadow .35s",
          }}/>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: "#e800a2", fontWeight: 700 }}>{names[2]}</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{scores[1]}</div>
          </div>
        </div>
      </div>

      {/* Territory bar */}
      <div style={{
        width: "100%", maxWidth: svgW + 16, height: 6, borderRadius: 3,
        background: "#1a1a2e", marginBottom: 8, overflow: "hidden",
        display: "flex",
      }}>
        <div style={{ height: "100%", width: `${bar1}%`, background: "linear-gradient(90deg,#00e8a2,#00cc88)", transition: "width .5s ease", borderRadius: "3px 0 0 3px" }}/>
        <div style={{ flex: 1 }}/>
        <div style={{ height: "100%", width: `${bar2}%`, background: "linear-gradient(90deg,#cc0088,#e800a2)", transition: "width .5s ease", borderRadius: "0 3px 3px 0" }}/>
      </div>

      {/* Board */}
      <div style={{
        background: "#0c0c18", borderRadius: 18, padding: 6,
        border: "1px solid #1a1a2e",
        boxShadow: "0 0 50px #00000060, inset 0 0 20px #00000030",
      }}>
        <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: "block", maxWidth: "96vw", height: "auto" }}>
          <defs>
            <radialGradient id="g1" cx="35%" cy="35%"><stop offset="0%" stopColor="#00ffb0"/><stop offset="100%" stopColor="#008855"/></radialGradient>
            <radialGradient id="g2" cx="35%" cy="35%"><stop offset="0%" stopColor="#ff60d0"/><stop offset="100%" stopColor="#aa0077"/></radialGradient>
            <filter id="gl1"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="gl2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => {
              const id = `${r}-${c}`;
              const { x, y } = hexXY(r, c);
              const owner = board[r][c];
              const isSel = sel && sel.r === r && sel.c === c;
              const move = moves.find(m => m.r === r && m.c === c);
              const isFlipped = flippedCells.includes(id);
              const isLast = lastMove && lastMove.r === r && lastMove.c === c;

              let fill = "#111122", stroke = "#1c1c32", sw = .7;
              if (owner) { fill = P[owner].fill; stroke = P[owner].stroke + "50"; sw = 1; }
              if (isSel) { stroke = "#fff"; sw = 2.2; }
              if (move) {
                fill = move.type === "split" ? "#0a2a1a" : "#2a2a0a";
                stroke = move.type === "split" ? "#00e8a240" : "#e8a80040";
                sw = 1.5;
              }
              const clickable = (!gameOver && !busy) && ((owner === turn) || !!move);

              return (
                <g key={id} onClick={() => selectCell(r, c)} style={{ cursor: clickable ? "pointer" : "default" }}>
                  <polygon points={hexPts(x, y, HEX - 1)} fill={fill} stroke={stroke} strokeWidth={sw}/>

                  {move && (
                    <>
                      <polygon points={hexPts(x, y, HEX - 5)}
                        fill="none"
                        stroke={move.type === "split" ? "#00e8a2" : "#e8a800"}
                        strokeWidth={1.3}
                        strokeDasharray={move.type === "leap" ? "4,3" : "none"}
                        opacity={.4}
                        style={{ animation: "hexG 1.1s ease-in-out infinite" }}/>
                      <text x={x} y={y + 4} textAnchor="middle" fontSize={move.type === "split" ? 12 : 9}
                        fill={move.type === "split" ? "#00e8a2" : "#e8a800"} fontWeight="700" opacity={.55}>
                        {move.type === "split" ? "+" : "⟶"}
                      </text>
                    </>
                  )}

                  {owner > 0 && (
                    <g style={isFlipped ? { animation: "flipC .42s ease-out" } : isLast ? { animation: "bounce .32s ease-out" } : undefined}>
                      <circle cx={x} cy={y} r={HEX * .42} fill={`url(#g${owner})`} filter={`url(#gl${owner})`}/>
                      <circle cx={x} cy={y} r={HEX * .42} fill="none" stroke={P[owner].glow} strokeWidth={1} opacity={.35}/>
                      <circle cx={x - HEX * .11} cy={y - HEX * .11} r={HEX * .11} fill="#fff" opacity={.13}/>
                    </g>
                  )}

                  {isSel && (
                    <circle cx={x} cy={y} r={HEX * .52} fill="none" stroke="#fff" strokeWidth={1.8} opacity={.5}
                      style={{ animation: "ringP 1s ease-in-out infinite" }}/>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Hint text */}
      <div style={{ marginTop: 10, fontSize: 11, color: "#3a3a5a", letterSpacing: 1, textAlign: "center", minHeight: 18 }}>
        {gameOver ? "" : !sel ? `${names[turn]}, tap one of your cells` :
          <span>
            <span style={{ color: "#00e8a2" }}>+</span> split (clone) &nbsp;
            <span style={{ color: "#e8a800" }}>⟶</span> leap (jump)
          </span>
        }
      </div>

      {/* Game Over */}
      {gameOver !== null && (
        <div style={{ textAlign: "center", animation: "fadeUp .45s ease-out", marginTop: 8 }}>
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: 5,
            color: gameOver === 0 ? "#7a7a9a" : P[gameOver].stroke,
          }}>
            {gameOver === 0 ? "TIE GAME!" : `${names[gameOver]} WINS!`}
          </div>
          <div style={{ fontSize: 12, color: "#4a4a6a", marginTop: 2 }}>
            {scores[0]} vs {scores[1]} · {moveCount} moves
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: gameOver ? 14 : 12 }}>
        {[
          { label: "↩ UNDO", action: undo, disabled: history.length === 0 || busy },
          { label: "↻ NEW GAME", action: reset, disabled: false },
          { label: "✕ MENU", action: () => setScreen("menu"), disabled: false },
        ].map((b, i) => (
          <button key={i} onClick={b.action} disabled={b.disabled} style={{
            background: "#0e0e1a", border: "1px solid #22223a", color: "#5a5a7a",
            padding: "9px 16px", borderRadius: 26, fontSize: 11, fontWeight: 600,
            cursor: b.disabled ? "not-allowed" : "pointer",
            letterSpacing: 1.5, opacity: b.disabled ? .3 : 1,
            transition: "all .25s",
          }}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
