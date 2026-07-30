import { ReactNode } from 'react';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl';

interface ContainerProps {
  children: ReactNode;
  size?: ContainerSize;
  className?: string;
}

const SIZE_CLASSES: Record<ContainerSize, string> = {
  sm: 'max-w-xl',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
};

export function Container({ children, size = 'lg', className = '' }: ContainerProps) {
  return (
    <div className={`mx-auto w-full ${SIZE_CLASSES[size]} ${className}`}>
      {children}
    </div>
  );
}
