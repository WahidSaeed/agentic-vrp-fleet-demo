// Synthetic conference demo - no real data.
// Esc-triggered overview: a thumbnail grid of every slide. Click or arrow-key +
// Enter to jump. Presenter-recovery feature. Duplicated in the other repo.
export default function OverviewGrid({ deck, current, onPick }) {
  return (
    <div className="deck-overview" role="listbox" aria-label="all slides">
      {deck.map((s, i) => (
        <div
          key={i}
          className={`deck-thumb ${i === current ? "active" : ""}`}
          role="option"
          aria-selected={i === current}
          onClick={() => onPick(i)}
        >
          <span className="n">{i + 1} / {deck.length}</span>
          <span className="t">{s.overviewTitle || s.title || s.heading || `Slide ${i + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
