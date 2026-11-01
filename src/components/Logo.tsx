/** Duevance mark: an open D bowl whose centre stroke exits the loop and keeps moving forward. */
type Tone = 'light' | 'dark' | 'mono'; // the background the logo sits on: light = on paper, dark = on ink
const COLORS: Record<Tone, { bowl: string; line: string }> = { light: { bowl: '#0C1226', line: '#2447F5' }, dark: { bowl: '#F7F5F1', line: '#5FE0A8' }, mono: { bowl: 'currentColor', line: 'currentColor' } };

export function Mark({ size = 32, tone = 'light', className, title }: { size?: number; tone?: Tone; className?: string; title?: string }) {
  const c = COLORS[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <g fill="none" strokeLinejoin="round">
        <path d="M12 8H22A16 16 0 0 1 36.83 18M36.83 30A16 16 0 0 1 22 40H12" stroke={c.bowl} strokeWidth="7" />
        <path d="M19 24H43" stroke={c.line} strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
export function Logo({ tone = 'light', size = 30, symbolOnly = false }: { tone?: Tone; size?: number; symbolOnly?: boolean }) {
  return (
    <span className="logo" data-tone={tone} style={{ ['--logo-size' as string]: `${size}px` }}>
      <Mark size={size} tone={tone} title={symbolOnly ? 'Duevance' : undefined} />
      {!symbolOnly && <span className="logo-word">Duevance</span>}
    </span>
  );
}
