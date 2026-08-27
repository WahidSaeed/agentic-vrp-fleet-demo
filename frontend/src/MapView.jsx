// Synthetic conference demo - no real data.
// MapLibre map with smoothly-interpolated vehicle markers and detour overlays.
// Uses the free MapLibre demo tiles (no API key, no billing).
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

const STYLE = "https://demotiles.maplibre.org/style.json";
const CENTER = [13.404, 52.52]; // Berlin

export default function MapView({ vehicles, disruption }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef({});
  const targets = useRef({});
  const raf = useRef(null);

  useEffect(() => {
    const map = new maplibregl.Map({ container: ref.current, style: STYLE, center: CENTER, zoom: 12 });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("detours", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "detours", type: "line", source: "detours", paint: { "line-color": "#ff8c00", "line-width": 4, "line-dasharray": [2, 1] } });
      map.addSource("disruption", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "disruption", type: "circle", source: "disruption", paint: { "circle-radius": 14, "circle-color": "#e11d48", "circle-opacity": 0.35, "circle-stroke-color": "#e11d48", "circle-stroke-width": 2 } });
    });

    const animate = () => {
      const m = mapRef.current;
      Object.entries(targets.current).forEach(([id, tgt]) => {
        let mk = markers.current[id];
        if (!mk) {
          const el = document.createElement("div");
          el.className = "veh-marker";
          mk = new maplibregl.Marker({ element: el }).setLngLat([tgt.lon, tgt.lat]).addTo(m);
          markers.current[id] = mk;
        }
        const cur = mk.getLngLat();
        const next = [cur.lng + (tgt.lon - cur.lng) * 0.15, cur.lat + (tgt.lat - cur.lat) * 0.15];
        mk.setLngLat(next);
        mk.getElement().classList.toggle("disrupted", id === disruption?.vehicleId);
      });
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(raf.current); map.remove(); };
  }, []);

  useEffect(() => {
    Object.values(vehicles).forEach((v) => {
      if (typeof v.lat === "number") targets.current[v.vehicleId] = { lat: v.lat, lon: v.lon };
    });
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const detourFeatures = Object.values(vehicles)
      .filter((v) => Array.isArray(v.activeDetour) && v.activeDetour.length > 1)
      .map((v) => ({ type: "Feature", geometry: { type: "LineString", coordinates: v.activeDetour } }));
    map.getSource("detours")?.setData({ type: "FeatureCollection", features: detourFeatures });

    map.getSource("disruption")?.setData({
      type: "FeatureCollection",
      features: disruption ? [{ type: "Feature", geometry: { type: "Point", coordinates: [disruption.lon, disruption.lat] } }] : [],
    });
  }, [vehicles, disruption]);

  return <div className="map" ref={ref} />;
}
