// Synthetic conference demo - no real data.
// Lazy-loaded entry for /slides so the demo pages don't ship framer-motion + qrcode.
import SlideDeck from "./engine/SlideDeck.jsx";
import { deck, demoRoute } from "./deck.js";

export default function SlideRoute() {
  return <SlideDeck deck={deck} demoRoute={demoRoute} />;
}
