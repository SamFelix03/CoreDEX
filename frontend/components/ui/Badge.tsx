interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color = "var(--muted)" }: BadgeProps) {
  return (
    <span style={{
      display:       "inline-flex",
      alignItems:    "center",
      padding:       "2px 8px",
      borderRadius:  2,
      fontFamily:    "'IBM Plex Mono',monospace",
      fontSize:      9,
      fontWeight:    500,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color,
      border:        `1px solid ${color}`,
      opacity:       0.8,
    }}>
      {label}
    </span>
  );
}
