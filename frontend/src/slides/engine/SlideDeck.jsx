// Synthetic conference demo - no real data.
// Route root for /slides: renders one slide at a time with a CSS cross-fade, plus
// the presenter chrome (progress bar, counter, overview, notes, timer). All
// navigation lives in useDeckNavigation. Zero network calls. No JS animation
// library - a stalled CSS transition still lands on a readable slide.
// Duplicated in the other demo repo by design.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeckNavigation } from "./useDeckNavigation.js";
import OverviewGrid from "./OverviewGrid.jsx";
import "../theme.css";

function Timer({ startRef }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((Date.now() - startRef.current) / 1000));
  return <div className="deck-timer">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</div>;
}

export default function SlideDeck({ deck, demoRoute }) {
  const navigate = useNavigate();
  const nav = useDeckNavigation(deck, {
    onLaunch: () => navigate(demoRoute + window.location.search),
  });
  const { slide, step, overview, chrome, notes, timer } = nav;
  const nofx =
    new URLSearchParams(window.location.search).has("nofx") ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const entry = deck[slide];
  const Current = entry.Component;
  const steps = entry.steps ?? 0;
  const subFraction = steps ? Math.min(step, steps) / steps : 0;
  const progress = deck.length > 1 ? ((slide + subFraction) / (deck.length - 1)) * 100 : 100;

  return (
    <div className={`deck ${chrome ? "" : "deck-chrome-hidden"} ${nofx ? "nofx" : ""}`}>
      <div className="deck-progress" style={{ width: `${Math.min(100, progress)}%` }} />

      <div
        className="deck-stage"
        onClick={(e) => {
          if (overview) return;
          if (e.target.closest("button, a, [role='option'], input, textarea")) return;
          nav.next();
        }}
      >
        {/* key forces a remount per slide so the CSS enter animation replays */}
        <div key={slide} className="deck-slide-enter">
          <Current step={step} onLaunch={nav.onLaunch} />
        </div>
      </div>

      {timer && <Timer startRef={nav.startRef} />}
      <div className="deck-counter">{slide + 1} / {deck.length}</div>
      <div className="deck-hint">← → navigate · Esc overview · F fullscreen · H hide · N notes</div>

      {notes && entry.notes && <div className="deck-notes">{entry.notes}</div>}

      {overview && (
        <OverviewGrid
          deck={deck}
          current={slide}
          onPick={(i) => { nav.goto(i); nav.setOverview(false); }}
        />
      )}
    </div>
  );
}
