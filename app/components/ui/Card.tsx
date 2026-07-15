import { ReactNode, HTMLAttributes } from 'react';

type CardElevation = 0 | 1 | 2 | 3;
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  padding?: CardPadding;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}

// elevation=0 reproduces today's sitewide default (flat, bordered, no shadow)
// exactly — the safe no-op target for opportunistically migrating an existing
// `bg-card border border-theme rounded-2xl` div to <Card> with zero visual diff.
const ELEVATION_CLASSES: Record<CardElevation, string> = {
  0: 'bg-card border border-theme',
  1: 'bg-card border border-theme shadow-elevation-1',
  2: 'bg-elevated border border-theme shadow-elevation-2',
  3: 'bg-surface-5 border border-theme shadow-elevation-3',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-8',
};

export default function Card({
  elevation = 1,
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-2xl ${ELEVATION_CLASSES[elevation]} ${PADDING_CLASSES[padding]} ${
        interactive ? 'hover:border-strong hover:shadow-elevation-2 transition-shadow cursor-pointer' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
