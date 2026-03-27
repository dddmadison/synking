import React from "react";

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="columns is-gapless is-mobile" style={{ minHeight: "100vh" }}>
      {/* Left visual / welcome */}
      <div
        className="column is-hidden-mobile is-4-desktop is-5-tablet"
        style={{
          background: "linear-gradient(135deg, #f5f7ff 0%, #edf1ff 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 className="title is-2" style={{ lineHeight: 1.2 }}>
            무엇이든 할 수 있는
            <br />
            <span style={{ color: "#2563eb" }}>씽킹</span>입니다.
          </h1>
          <p className="subtitle is-5" style={{ color: "#4b5563" }}>
            씽킹에서 업무 효율을 높여보세요
          </p>
        </div>
      </div>

      {/* Right form */}
      <div
        className="column is-full-mobile is-8-desktop is-7-tablet"
        style={{ display: "grid", placeItems: "center", padding: 32 }}
      >
        <div
          className="box"
          style={{
            width: "100%",
            maxWidth: 880,
            boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
            borderRadius: 20,
            padding: "28px 28px 24px",
          }}
        >
          <h2 className="title is-2" style={{ marginBottom: 8 }}>
            {title}
          </h2>
          {subtitle && (
            <p className="subtitle is-5 has-text-grey" style={{ marginBottom: 24 }}>
              {subtitle}
            </p>
          )}
          {children}
          {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
