// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function Solver() {
  return (
    <SlideFrame eyebrow="Why a real solver" heading="The LLM explains the optimisation. It doesn't invent the route.">
      <Reveal>
        <pre>
{`minimise   total travel time
subject to  visit every remaining stop exactly once
            start at the vehicle's current position
            never use a road segment near the disruption
            no sub-tours  (MTZ)`}
        </pre>
      </Reveal>
      <ul className="deck-list">
        <Reveal as="li">Solved in-process by <strong>HiGHS</strong> — WASM, MIT-licensed, no server.</Reveal>
        <Reveal as="li">Bedrock gets the before/after numbers and writes the sentence a dispatcher reads aloud.</Reveal>
      </ul>
    </SlideFrame>
  );
}
