import { ReactNode } from 'react';

type ShellSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ShellProps {
  children: ReactNode;
  size?: ShellSize;
  className?: string;
}

const SIZE_CLASSES: Record<ShellSize, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-4xl',
  lg: 'max-w-5xl',
  xl: 'max-w-7xl',
  full: '',
};

export function Shell({ children, size = 'xl', className = '' }: ShellProps) {
  return (
    <div className={`mx-auto px-4 sm:px-6 md:px-8 ${SIZE_CLASSES[size]} ${className}`}>
      {children}
    </div>
  );
}
