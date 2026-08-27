// Synthetic conference demo - no real data.
import React from "react";
import { NavLink, Outlet } from "react-router-dom";

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("view crashed:", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div className="crash">
          <h2>View hiccup — recovering</h2>
          <button onClick={() => this.setState({ err: null })}>Reload view</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Agentic VRP — Self-Healing Logistics</span>
        <nav>
          <NavLink to="/driver">Driver</NavLink>
          <NavLink to="/dispatcher">Dispatcher</NavLink>
        </nav>
        <span className="synthetic-badge">SYNTHETIC DATA · DEMO</span>
      </header>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </div>
  );
}
