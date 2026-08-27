// Synthetic conference demo - no real data.
import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import App from "./App.jsx";
import DriverView from "./DriverView.jsx";
import DispatcherView from "./DispatcherView.jsx";
import "./styles.css";
import "maplibre-gl/dist/maplibre-gl.css";

const SlideRoute = lazy(() => import("./slides/SlideRoute.jsx"));

const router = createBrowserRouter([
  { path: "/slides", element: <Suspense fallback={null}><SlideRoute /></Suspense> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/driver" replace /> },
      { path: "driver", element: <DriverView /> },
      { path: "dispatcher", element: <DispatcherView /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
