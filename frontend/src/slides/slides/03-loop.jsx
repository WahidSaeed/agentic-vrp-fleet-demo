// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

const WORDS = ["Sense", "Reason", "Act", "with a human gate"];

export default function Loop() {
  return (
    <SlideFrame eyebrow="The loop, in one sentence"
      heading="Sense → Reason → Act — with a human in the loop for anything risky.">
      <Reveal className="deck-flow">
        {WORDS.map((w, i) => (
          <span key={w} style={{ display: "contents" }}>
            {i > 0 && <span className="deck-flow-arrow">→</span>}
            <span className="deck-flow-word">{w}</span>
          </span>
        ))}
      </Reveal>
      <Reveal className="deck-sub">Hold this shape — the real architecture is just this, wired up.</Reveal>
    </SlideFrame>
  );
}
