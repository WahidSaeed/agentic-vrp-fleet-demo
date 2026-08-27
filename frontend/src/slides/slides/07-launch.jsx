// Synthetic conference demo - no real data.
import SlideFrame, { Reveal } from "../engine/SlideFrame.jsx";

export default function Launch({ onLaunch }) {
  return (
    <SlideFrame center eyebrow="Live" title="Let's see it happen.">
      <Reveal>
        <button className="deck-cta" onClick={onLaunch} autoFocus>
          Open the live map →
        </button>
      </Reveal>
      <Reveal className="deck-sub">Same mode as this page — live if you added <code>?live</code>, replay otherwise.</Reveal>
    </SlideFrame>
  );
}
