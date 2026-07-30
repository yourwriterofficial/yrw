import { ElementType, HTMLAttributes, ReactNode } from 'react';

type CardElevation = 0 | 1 | 2 | 3;
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  padding?: CardPadding;
  interactive?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  divider?: boolean;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

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
  lg: 'p-6 md:p-8',
};

export default function Card({
  elevation = 1,
  padding = 'md',
  interactive = false,
  header,
  footer,
  divider = false,
  as: Component = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  const baseClass = `rounded-2xl ${ELEVATION_CLASSES[elevation]} ${PADDING_CLASSES[padding]} ${
    interactive ? 'hover:border-strong hover:shadow-elevation-2 transition-shadow cursor-pointer' : ''
  } ${className}`;

  return (
    <Component className={baseClass} {...rest}>
      {header && (
        <>
          <div className="pb-4">{header}</div>
          {divider && <div className="border-b border-theme -mx-5 px-5 mb-5" />}
        </>
      )}
      {children}
      {footer && (
        <>
          {divider && <div className="border-t border-theme -mx-5 px-5 mt-5" />}
          <div className="pt-4">{footer}</div>
        </>
      )}
    </Component>
  );
}
