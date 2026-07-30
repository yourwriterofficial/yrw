'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideClose?: boolean;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export function Dialog({ open, onOpenChange, children, title, description, size = 'md', hideClose }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full ${SIZE_CLASSES[size]} bg-card border border-theme rounded-2xl shadow-elevation-3 p-6 max-h-[90vh] overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95`}
        >
          {(title || !hideClose) && (
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-1">
                {title && <DialogPrimitive.Title className="text-lg font-bold text-primary">{title}</DialogPrimitive.Title>}
                {description && <DialogPrimitive.Description className="text-sm text-secondary">{description}</DialogPrimitive.Description>}
              </div>
              {!hideClose && (
                <DialogPrimitive.Close className="p-2 -mr-2 -mt-2 rounded-lg text-secondary hover:text-primary hover:bg-hover transition-colors" aria-label="Close">
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>
              )}
            </div>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;
