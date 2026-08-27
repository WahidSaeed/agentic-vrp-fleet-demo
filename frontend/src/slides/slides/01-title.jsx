// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function Title() {
  return (
    <SlideFrame eyebrow="AWS Community Day" title="Agentic VRP: Architecting Self-Healing Logistics">
      <Reveal className="deck-lede">
        A personal, pre-MVP look at agentic reasoning applied to vehicle routing.
      </Reveal>
      <Reveal className="deck-sub">Synthetic data · demo, not a production system</Reveal>
    </SlideFrame>
  );
}
