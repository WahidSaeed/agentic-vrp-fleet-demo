// Synthetic conference demo - no real data.
// Offline QR code: rendered locally from the `qrcode` package to inline SVG.
// No external QR API. Duplicated in the other demo repo by design.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QR({ value, size = 172 }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value]);
  return (
    <div className="deck-qr" style={{ width: size, height: size }}
      aria-label={`QR code for ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
