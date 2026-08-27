// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";
import QR from "../engine/QR.jsx";

const REPO = "https://github.com/WahidSaeed/agentic-vrp-fleet-demo";

export default function Thanks() {
  return (
    <SlideFrame center eyebrow="Thank you" title="Questions?">
      <Reveal className="deck-links">
        <QR value={REPO} />
        <span className="u">
          <b>Code &amp; hosted demo</b>
          github.com/WahidSaeed/agentic-vrp-fleet-demo
        </span>
      </Reveal>
      <Reveal className="deck-sub">All data synthetic. Demo code, not a production system.</Reveal>
    </SlideFrame>
  );
}
