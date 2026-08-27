// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function Problem() {
  return (
    <SlideFrame eyebrow="The problem" heading="Static VRP solvers don't know a road just closed.">
      <ul className="deck-list">
        <Reveal as="li">A route optimised at 06:00 is a plan, not a promise — the city changes all day.</Reveal>
        <Reveal as="li">Re-solving the whole fleet on every incident is slow and disruptive.</Reveal>
        <Reveal as="li">The judgement call — "is this detour worth interrupting the driver?" — still needs a human.</Reveal>
      </ul>
    </SlideFrame>
  );
}
