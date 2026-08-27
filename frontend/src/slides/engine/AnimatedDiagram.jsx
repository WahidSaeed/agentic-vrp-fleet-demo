// Synthetic conference demo - no real data.
// Generic step-by-step architecture diagram: an ordered set of boxes and the
// arrows between them, revealed one "beat" at a time (a box + the arrows that
// end on it). Which boxes are visible is driven by the `step` prop (React
// state), so the build-up works even with animation throttled/disabled; the
// fade/draw is pure CSS on top. Once the whole diagram is up, a subtle dash
// travels each arrow to suggest live data flow.
//
// Coordinate space is a fixed 1000 x 560 viewBox; boxes give {x,y,w,h} in it.
// Reused by both demo repos' architecture slides - only the box/arrow lists differ.
const VB_W = 1000, VB_H = 560;

const FILL = {
  neutral: ["#1E3350", "#16283F"],
  teal: ["#1F9C88", "#137a6b"],
  amber: ["#C9601F", "#a24d18"],
};
const STROKE = { neutral: "#2C4160", teal: "#7FD8C7", amber: "#E8823C" };

function edges(a, b) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      from: { x: dx >= 0 ? a.x + a.w : a.x, y: ac.y },
      to: { x: dx >= 0 ? b.x : b.x + b.w, y: bc.y },
      horiz: true,
    };
  }
  return {
    from: { x: ac.x, y: dy >= 0 ? a.y + a.h : a.y },
    to: { x: bc.x, y: dy >= 0 ? b.y : b.y + b.h },
    horiz: false,
  };
}

function pathFor(a, b) {
  const { from, to, horiz } = edges(a, b);
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  return horiz
    ? `M ${from.x} ${from.y} C ${mx} ${from.y}, ${mx} ${to.y}, ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} C ${from.x} ${my}, ${to.x} ${my}, ${to.x} ${to.y}`;
}

export default function AnimatedDiagram({ boxes, arrows = [], step, caption }) {
  const byId = Object.fromEntries(boxes.map((b) => [b.id, b]));
  const shown = boxes.slice(0, Math.max(0, step));
  const shownIds = new Set(shown.map((b) => b.id));
  const complete = step >= boxes.length;
  const liveArrows = arrows.filter((ar) => shownIds.has(ar.from) && shownIds.has(ar.to));

  return (
    <div className="deck-diagram">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="architecture diagram">
        <defs>
          <marker id="dgm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#7FD8C7" />
          </marker>
          {boxes.map((b) => {
            const [f1, f2] = FILL[b.variant || "neutral"];
            return (
              <linearGradient key={b.id} id={`dgm-g-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={f1} /><stop offset="1" stopColor={f2} />
              </linearGradient>
            );
          })}
        </defs>

        {liveArrows.map((ar, i) => {
          const d = pathFor(byId[ar.from], byId[ar.to]);
          return (
            <g key={`${ar.from}-${ar.to}-${i}`}>
              <path className="dgm-arrow-draw" d={d} pathLength="1" fill="none" stroke="#7FD8C7"
                strokeWidth="2.5" markerEnd="url(#dgm-arrow)" />
              {complete && (
                <path className="dgm-flow" d={d} fill="none" stroke="#F4EFE6"
                  strokeWidth="2.5" strokeDasharray="3 14" strokeLinecap="round" />
              )}
              {ar.label && (
                <text className="dgm-arrow-label" textAnchor="middle"
                  x={(byId[ar.from].x + byId[ar.from].w / 2 + byId[ar.to].x + byId[ar.to].w / 2) / 2}
                  y={(byId[ar.from].y + byId[ar.to].y) / 2 - 6}>{ar.label}</text>
              )}
            </g>
          );
        })}

        {shown.map((b) => (
          <g key={b.id} className="dgm-box-enter">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="12"
              fill={`url(#dgm-g-${b.id})`} stroke={STROKE[b.variant || "neutral"]} strokeWidth="1.75" />
            <text className="dgm-title" x={b.x + b.w / 2}
              y={b.y + (b.sub ? b.h / 2 - 6 : b.h / 2 + 1)}
              textAnchor="middle" dominantBaseline="middle">{b.title}</text>
            {b.sub && (
              <text className="dgm-sub" x={b.x + b.w / 2} y={b.y + b.h / 2 + 16}
                textAnchor="middle" dominantBaseline="middle">{b.sub}</text>
            )}
          </g>
        ))}
      </svg>
      {caption && <div className="deck-diagram-cap">{caption}</div>}
    </div>
  );
}
