// Synthetic conference demo - no real data.
// The optimiser step. Given a travel-time matrix over [current position, stop_1,
// ... stop_n], solve for the fastest order to visit every remaining stop once,
// starting at the current position and not returning - an open Travelling
// Salesman path, written as a mixed-integer program and solved in-process with
// HiGHS (WASM, no solver server, no licence).
//
// Formulation:
//   x_ij in {0,1}   arc i->j is used            (i in 0..n, j in 1..n, i != j)
//   u_i  in [1,n]    MTZ position of stop i      (i in 1..n)
//   min  sum c_ij x_ij
//   s.t. sum_j x_0j = 1                          leave the start once
//        sum_i x_ij = 1        for each stop j   enter every stop once
//        sum_j x_ij <= 1       for each stop i   leave a stop at most once
//        sum_ij x_ij = n                         n arcs for n+1 nodes
//        u_i - u_j + n x_ij <= n-1   i,j in 1..n, i != j    (no subtours)

let highsPromise = null;
function loadHighs() {
  if (!highsPromise) highsPromise = require("highs")();
  return highsPromise;
}

const F = (n) => Number(n).toFixed(4);

function buildLp(c) {
  const n = c.length - 1; // number of stops (node 0 is the current position)
  const arcs = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 1; j <= n; j++) {
      if (i === j) continue;
      if (!Number.isFinite(c[i][j])) continue; // unreachable arc - omit
      arcs.push([i, j]);
    }
  }
  const x = (i, j) => `x_${i}_${j}`;
  const L = [];
  L.push("Minimize");
  L.push(" obj: " + arcs.map(([i, j]) => `${F(c[i][j])} ${x(i, j)}`).join(" + "));
  L.push("Subject To");
  // leave the start exactly once
  L.push(" leave0: " + arcs.filter(([i]) => i === 0).map(([i, j]) => x(i, j)).join(" + ") + " = 1");
  // enter every stop exactly once
  for (let j = 1; j <= n; j++) {
    const t = arcs.filter(([, jj]) => jj === j).map(([i]) => x(i, j));
    L.push(` in_${j}: ` + t.join(" + ") + " = 1");
  }
  // leave every stop at most once
  for (let i = 1; i <= n; i++) {
    const t = arcs.filter(([ii]) => ii === i).map(([, j]) => x(i, j));
    if (t.length) L.push(` out_${i}: ` + t.join(" + ") + " <= 1");
  }
  // exactly n arcs
  L.push(" count: " + arcs.map(([i, j]) => x(i, j)).join(" + ") + ` = ${n}`);
  // MTZ subtour elimination
  for (const [i, j] of arcs) {
    if (i === 0 || j === 0) continue;
    L.push(` mtz_${i}_${j}: u_${i} - u_${j} + ${n} ${x(i, j)} <= ${n - 1}`);
  }
  L.push("Bounds");
  for (let i = 1; i <= n; i++) L.push(` 1 <= u_${i} <= ${n}`);
  L.push("Binary");
  for (const [i, j] of arcs) L.push(" " + x(i, j));
  L.push("General");
  for (let i = 1; i <= n; i++) L.push(` u_${i}`);
  L.push("End");
  return { lp: L.join("\n"), arcs, n };
}

// order stops (0 = current position implicit) -> array of stop indices 1..n
function orderFromSolution(sol, arcs, n) {
  const next = new Map();
  for (const [i, j] of arcs) {
    const v = sol.Columns[`x_${i}_${j}`]?.Primal ?? 0;
    if (v > 0.5) next.set(i, j);
  }
  const order = [];
  let cur = 0;
  for (let k = 0; k < n && next.has(cur); k++) { cur = next.get(cur); order.push(cur); }
  return order;
}

// c: (n+1)x(n+1) minutes matrix. Returns { order, minutes } or throws.
async function solveOpenTsp(c) {
  const n = c.length - 1;
  if (n <= 1) return { order: n === 1 ? [1] : [], minutes: n === 1 ? c[0][1] : 0 };

  const { lp, arcs } = buildLp(c);
  const highs = await loadHighs();
  const sol = highs.solve(lp);
  if (sol.Status !== "Optimal") throw new Error(`HiGHS status ${sol.Status}`);
  const order = orderFromSolution(sol, arcs, n);
  if (order.length !== n) throw new Error("infeasible ordering from solver");

  let minutes = 0, prev = 0;
  for (const s of order) { minutes += c[prev][s]; prev = s; }
  return { order, minutes, objective: sol.ObjectiveValue };
}

// baseline: visit the stops in their given (route) order, no re-optimisation
function inOrderMinutes(c) {
  let m = 0;
  for (let i = 0; i < c.length - 1; i++) {
    const leg = c[i][i + 1];
    if (!Number.isFinite(leg)) return Infinity;
    m += leg;
  }
  return m;
}

module.exports = { solveOpenTsp, inOrderMinutes, buildLp };
