import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
export const alt = "A little data. A world of possibility.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#f8f6ef",
        width: "100%",
        height: "100%",
        padding: 80,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          color: "#6747e8",
          fontSize: 45,
          fontWeight: 700,
          marginBottom: 40,
        }}
      >
        {brand.name.toLowerCase()}.
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 80,
          letterSpacing: -4,
          fontWeight: 700,
        }}
      >
        <span>Go somewhere.</span>
        <span style={{ color: "#6747e8" }}>Stay connected.</span>
      </div>
      <div style={{ fontSize: 25, color: "#777", marginTop: 35 }}>
        A little data. A world of possibility.
      </div>
    </div>,
    size,
  );
}
