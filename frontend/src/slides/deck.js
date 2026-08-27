// Synthetic conference demo - no real data.
// Ordered slide list for the fleet deck. The engine (src/slides/engine/*) is
// duplicated verbatim in the AML repo; only this file and slides/* differ.
import Title from "./slides/01-title.jsx";
import Problem from "./slides/02-problem.jsx";
import Loop from "./slides/03-loop.jsx";
import Architecture from "./slides/04-architecture.jsx";
import Solver from "./slides/05-solver.jsx";
import Reliability from "./slides/06-reliability.jsx";
import Launch from "./slides/07-launch.jsx";
import WhatsNext from "./slides/08-next.jsx";
import Thanks from "./slides/09-thanks.jsx";
import { STEPS as ARCH_STEPS } from "./slides/architecture.js";

export const demoRoute = "/driver";

export const deck = [
  { Component: Title, overviewTitle: "Title", title: "Agentic VRP",
    notes: "AWS Community Day. Personal project, pre-MVP. Everything synthetic." },
  { Component: Problem, overviewTitle: "The problem",
    notes: "The morning plan is stale by lunch. Full re-solves are heavy. The go/no-go call needs a human." },
  { Component: Loop, overviewTitle: "Sense → Reason → Act",
    notes: "Give them the mental model before the real diagram. Four beats." },
  { Component: Architecture, overviewTitle: "Architecture (build-up)", steps: ARCH_STEPS,
    notes: "One 'next' per box. Simulator → Kinesis → stream-processor → graph → HiGHS MIP → Bedrock → gate → dispatcher → map. Name the three reasoning components." },
  { Component: Solver, overviewTitle: "Real solver, not a guess",
    notes: "The MIP objective in plain language. HiGHS runs in the Lambda. Bedrock only explains." },
  { Component: Reliability, overviewTitle: "Fallback chain",
    notes: "Four levels, each dimmer. The demo degrades, never breaks." },
  { Component: Launch, launch: true, overviewTitle: "→ Live demo",
    notes: "Press the button / click. Hands off to /driver in the same mode." },
  { Component: WhatsNext, overviewTitle: "What's next",
    notes: "Come back here after the live segment. Honest open problems." },
  { Component: Thanks, overviewTitle: "Thank you / Q&A",
    notes: "QR to the repo. Restate: synthetic data, demo code." },
];
