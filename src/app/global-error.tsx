"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", margin: 0, padding: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "20px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "900", color: "#e50914", marginBottom: "12px" }}>STREAMVAULT</h1>
          <h2 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "16px" }}>Critical System Error</h2>
          <p style={{ color: "#a1a1aa", maxWidth: "450px", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
            A critical rendering failure occurred. Please reload the application to restore service.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: "#e50914",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 28px",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
