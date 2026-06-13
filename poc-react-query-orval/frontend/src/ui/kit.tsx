import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/**
 * A tiny shared UI kit so every concept page looks consistent without each one
 * re-declaring a `styles` block. Plain inline styles — zero CSS dependencies,
 * matching the original POC aesthetic (indigo accent, soft cards).
 */

export const tokens = {
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  accentBorder: '#c7d2fe',
  border: '#e0e0e0',
  text: '#222',
  muted: '#666',
  faint: '#999',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  radius: 10,
} as const;

/** Page title block: big emoji + title + one-line subtitle. */
export function PageHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>
        {icon} {title}
      </h1>
      <p style={{ color: tokens.muted, fontSize: 14, margin: '6px 0 0' }}>{subtitle}</p>
    </header>
  );
}

/** Soft white card. */
export function Card({
  children,
  style,
  highlight,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Briefly accent the border (e.g. an item that just changed). */
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${highlight ? tokens.accentBorder : tokens.border}`,
        borderRadius: tokens.radius,
        padding: 14,
        background: '#fff',
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: highlight ? `0 0 0 3px ${tokens.accentSoft}` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'green' | 'red' | 'amber';

const badgeColors: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: '#f1f5f9', fg: '#334155' },
  accent: { bg: tokens.accentSoft, fg: tokens.accent },
  green: { bg: '#dcfce7', fg: '#15803d' },
  red: { bg: '#fee2e2', fg: '#b91c1c' },
  amber: { bg: '#fef3c7', fg: '#b45309' },
};

/** Small rounded pill. */
export function Badge({
  children,
  tone = 'neutral',
  style,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
}) {
  const c = badgeColors[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        padding: '3px 10px',
        borderRadius: 999,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Primary (filled) button. Falls back to the global button style otherwise. */
export function Button({
  children,
  primary,
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      {...rest}
      style={{
        ...(primary
          ? { background: tokens.accent, color: '#fff', borderColor: tokens.accent }
          : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

type CalloutTone = 'info' | 'success' | 'danger';

const calloutColors: Record<CalloutTone, { bg: string; border: string }> = {
  info: { bg: '#fffbeb', border: '#fde68a' },
  success: { bg: '#f0fdf4', border: '#bbf7d0' },
  danger: { bg: '#fef2f2', border: '#fecaca' },
};

/** Highlighted explanatory box (the "what to notice" callouts). */
export function Callout({
  children,
  tone = 'info',
  style,
}: {
  children: ReactNode;
  tone?: CalloutTone;
  style?: CSSProperties;
}) {
  const c = calloutColors[tone];
  return (
    <div
      style={{
        fontSize: 13.5,
        color: '#444',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: '10px 13px',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Inline monospace code chip. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.88em',
        background: '#f1f5f9',
        padding: '1px 5px',
        borderRadius: 4,
      }}
    >
      {children}
    </code>
  );
}

/** Counts renders of the calling component (for "this re-rendered N×" badges). */
export function useRenderCount() {
  const renders = useRef(0);
  renders.current += 1;
  return renders.current;
}

/** Footnote pointing at the source files / wiki page. */
export function Footnote({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: tokens.faint, fontSize: 12, marginTop: 20 }}>{children}</p>
  );
}

/** Inline spinner (uses the global `spin` keyframes in index.css). */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${tokens.border}`,
        borderTopColor: tokens.accent,
        animation: 'spin 0.8s linear infinite',
        verticalAlign: 'middle',
      }}
    />
  );
}

/** Section heading used to split a page into labelled demo blocks. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ fontSize: 16, margin: '28px 0 4px', display: 'flex', gap: 8, alignItems: 'center' }}>
      {children}
    </h2>
  );
}
