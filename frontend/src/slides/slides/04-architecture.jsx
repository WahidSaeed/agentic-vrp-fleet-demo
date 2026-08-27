// Synthetic conference demo - no real data.
import SlideFrame from "../engine/SlideFrame.jsx";
import AnimatedDiagram from "../engine/AnimatedDiagram.jsx";
import { BOXES, ARROWS } from "./architecture.js";

export default function Architecture({ step }) {
  return (
    <SlideFrame eyebrow="How it works" heading="One disruption, end to end">
      <AnimatedDiagram
        boxes={BOXES}
        arrows={ARROWS}
        step={step + 1}
        caption="The reasoning core is three real components — a graph query, a MIP solve, and an LLM that explains the result."
      />
    </SlideFrame>
  );
}
