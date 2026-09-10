"use client";

/**
 * Last-resort error boundary (observability-and-errors.md pillar 5) — catches failures in the root
 * layout itself, which `error.jsx` cannot: at this point React has unmounted everything, so this
 * component must render its own `<html>`/`<body>`.
 *
 * Deliberately dependency-free (inline styles, no `cn`, no UI components, no fonts): whatever broke
 * may be the very thing those imports need. The digest is still shown, since that is the one string
 * that ties a user's report to the server log line written by `onRequestError`.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f7f9",
          color: "#12141a",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            background: "#fff",
            border: "1px solid #e3e6ea",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>StoryBoard could not start</h1>
          <p style={{ marginTop: "8px", fontSize: "14px", lineHeight: 1.6, color: "#5b6270" }}>
            The application shell failed to render. This is recorded on the server; quote the
            reference below when reporting it.
          </p>

          {error?.digest && (
            <div
              style={{
                marginTop: "20px",
                padding: "10px 12px",
                background: "#f6f7f9",
                border: "1px solid #e3e6ea",
                borderRadius: "8px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "13px",
                wordBreak: "break-all",
              }}
            >
              {error.digest}
            </div>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              padding: "9px 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              background: "#12141a",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
