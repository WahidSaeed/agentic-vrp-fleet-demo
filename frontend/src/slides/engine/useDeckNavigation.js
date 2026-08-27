// Synthetic conference demo - no real data.
// Deck navigation: one place for the (slide, step) cursor and every keyboard
// shortcut. Duplicated verbatim in the other demo repo by design.
//
// A slide may declare `steps: N` (extra sub-steps, e.g. an architecture diagram
// building up one box at a time). "next" walks the sub-steps first, then the
// next slide; "prev" walks back into the previous slide's last sub-step.
import { useCallback, useEffect, useRef, useState } from "react";

export function useDeckNavigation(deck, { onLaunch } = {}) {
  const stepsFor = (i) => deck[i]?.steps ?? 0;
  const lastIndex = deck.length - 1;
  const launchIndex = deck.findIndex((s) => s.launch);

  const [cursor, setCursor] = useState({ slide: 0, step: 0 });
  const [overview, setOverview] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [notes, setNotes] = useState(false);
  const [timer, setTimer] = useState(false);
  const startRef = useRef(Date.now());

  const goto = useCallback((i, atLastStep = false) => {
    const slide = Math.max(0, Math.min(lastIndex, i));
    setCursor({ slide, step: atLastStep ? stepsFor(slide) : 0 });
  }, [lastIndex]);

  const next = useCallback(() => {
    setCursor(({ slide, step }) => {
      if (step < stepsFor(slide)) return { slide, step: step + 1 };
      if (slide < lastIndex) return { slide: slide + 1, step: 0 };
      return { slide, step };
    });
  }, [lastIndex]);

  const prev = useCallback(() => {
    setCursor(({ slide, step }) => {
      if (step > 0) return { slide, step: step - 1 };
      if (slide > 0) return { slide: slide - 1, step: stepsFor(slide - 1) };
      return { slide, step };
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (overview) {
        if (k === "Escape" || k === "Enter" || k === " ") { setOverview(false); e.preventDefault(); }
        else if (k === "ArrowRight" || k === "ArrowDown") goto(cursor.slide + 1);
        else if (k === "ArrowLeft" || k === "ArrowUp") goto(cursor.slide - 1);
        else if (/^[1-9]$/.test(k)) { goto(Number(k) - 1); setOverview(false); }
        return;
      }
      if (k === "ArrowRight" || k === " " || k === "PageDown") { next(); e.preventDefault(); }
      else if (k === "ArrowLeft" || k === "PageUp") { prev(); e.preventDefault(); }
      else if (k === "Home") goto(0);
      else if (k === "End") goto(launchIndex >= 0 ? launchIndex : lastIndex, true);
      else if (k === "Escape") { setOverview(true); e.preventDefault(); }
      else if (k === "f" || k === "F") toggleFullscreen();
      else if (k === "h" || k === "H") setChrome((c) => !c);
      else if (k === "n" || k === "N") setNotes((n) => !n);
      else if (k === "t" || k === "T") setTimer((t) => !t);
      else if (/^[1-9]$/.test(k)) goto(Number(k) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overview, cursor.slide, next, prev, goto, toggleFullscreen, launchIndex, lastIndex]);

  // optional ?autoplay: advance sub-steps (and roll to the next slide) for
  // recording a fallback video. Never runs past the last slide.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autoplay")) return;
    const id = setInterval(() => {
      setCursor(({ slide, step }) => {
        if (step < stepsFor(slide)) return { slide, step: step + 1 };
        if (slide < lastIndex) return { slide: slide + 1, step: 0 };
        clearInterval(id);
        return { slide, step };
      });
    }, 1500);
    return () => clearInterval(id);
  }, [lastIndex]);

  return {
    slide: cursor.slide, step: cursor.step,
    overview, chrome, notes, timer, startRef, launchIndex,
    next, prev, goto, setOverview, toggleFullscreen, onLaunch,
  };
}
