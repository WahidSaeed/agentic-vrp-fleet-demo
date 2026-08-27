// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function WhatsNext() {
  return (
    <SlideFrame eyebrow="Pre-MVP" heading="What's still open">
      <ul className="deck-list">
        <Reveal as="li">Cost and latency of graph + solver + LLM calls at fleet scale, not demo scale.</Reveal>
        <Reveal as="li">Validating agent decisions against ground truth — did the detour actually help?</Reveal>
        <Reveal as="li">Multi-vehicle re-assignment, not just re-sequencing one vehicle's stops.</Reveal>
        <Reveal as="li">A real road-network graph and live traffic, not four hand-drawn loops.</Reveal>
      </ul>
    </SlideFrame>
  );
}
