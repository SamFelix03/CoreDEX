export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--pink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
