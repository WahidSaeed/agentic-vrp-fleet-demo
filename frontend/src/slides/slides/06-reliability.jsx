// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function Reliability() {
  return (
    <SlideFrame eyebrow="Reliability" heading="It can't stall on stage — four levels of fallback.">
      <ul className="deck-list dimming">
        <Reveal as="li">Neo4j road graph + HiGHS MIP + Bedrock rationale</Reveal>
        <Reveal as="li">Neo4j down → bundled graph JSON + HiGHS MIP + Bedrock</Reveal>
        <Reveal as="li">solver / graph error → deterministic canned detour</Reveal>
        <Reveal as="li">Bedrock error → templated summary from the solver numbers</Reveal>
      </ul>
      <Reveal className="deck-sub">Same reasoning as replay mode: the demo degrades, it never breaks.</Reveal>
    </SlideFrame>
  );
}
