import React from "react";

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  right,
  ...rest
}) {
  return (
    <div className="field" style={{ marginBottom: 18 }}>
      {label && (
        <label className="label" style={{ fontWeight: 700, fontSize: 16 }}>
          {label}
        </label>
      )}
      <div className="control has-icons-right">
        <input
          className={`input ${error ? "is-danger" : ""}`}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          {...rest}
          style={{
            height: 56,
            fontSize: 16,
          }}
        />
        {right && (
          <span
            className="icon is-right"
            style={{ pointerEvents: "auto", cursor: "pointer", fontSize: 18 }}
            onClick={right.onClick}
          >
            {right.node}
          </span>
        )}
      </div>
      {error && (
        <p className="help is-danger" style={{ marginTop: 6, fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
