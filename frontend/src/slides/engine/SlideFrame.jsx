// Synthetic conference demo - no real data.
// Shared per-slide layout: optional eyebrow + heading, then the content area.
// Children reveal in reading order via a pure-CSS fade+rise. Deliberately NOT
// JS-driven: a CSS animation that is throttled, disabled, or interrupted still
// leaves the element at its resting (visible) state, so the deck can never get
// stuck half-faded on stage. Duplicated in the other demo repo by design.
import { createContext, useContext } from "react";

const OrderCtx = createContext({ n: 0 });

export default function SlideFrame({ eyebrow, title, heading, children, className = "", center = false }) {
  const order = { n: 0 };
  let i = 0;
  const style = (k) => ({ animationDelay: `${0.05 + k * 0.09}s` });
  return (
    <div className={`deck-slide ${center ? "deck-launch" : ""} ${className}`}>
      {eyebrow && <div className="deck-eyebrow deck-reveal" style={style(i++)}>{eyebrow}</div>}
      {title && <h1 className="deck-h1 deck-reveal" style={style(i++)}>{title}</h1>}
      {heading && <h2 className="deck-h2 deck-reveal" style={style(i++)}>{heading}</h2>}
      <OrderCtx.Provider value={{ n: i }}>{children}</OrderCtx.Provider>
    </div>
  );
}

// A staggered child. Its reveal order is taken from the surrounding SlideFrame.
export function Reveal({ as: Tag = "div", className = "", style, children, ...rest }) {
  const ctx = useContext(OrderCtx);
  const i = ctx.n++;
  return (
    <Tag
      className={`${className} deck-reveal`.trim()}
      style={{ animationDelay: `${0.05 + i * 0.09}s`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
