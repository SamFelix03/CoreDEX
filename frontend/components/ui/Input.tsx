interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
}

export function Input({ label, suffix, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label style={{
          fontFamily: "'IBM Plex Mono',monospace", fontSize: 9,
          color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          {...props}
          style={{
            width:         "100%",
            padding:       "8px 12px",
            paddingRight:  suffix ? 48 : 12,
            background:    "var(--surface2)",
            border:        "1px solid var(--border)",
            borderRadius:  3,
            fontFamily:    "'IBM Plex Mono',monospace",
            fontSize:      13,
            color:         "var(--text)",
            ...style,
          }}
        />
        {suffix && (
          <span style={{
            position:   "absolute",
            right:      12,
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize:   10,
            color:      "var(--muted)",
          }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
