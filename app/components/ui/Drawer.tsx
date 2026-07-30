'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  description?: string;
  position?: 'left' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const POSITION_CLASSES: Record<string, string> = {
  left: 'left-0 top-0 bottom-0 h-full border-r',
  right: 'right-0 top-0 bottom-0 h-full border-l',
  bottom: 'left-0 right-0 bottom-0 border-t rounded-t-2xl',
};

const SIZE_CLASSES: Record<string, Record<string, string>> = {
  left: { sm: 'w-80', md: 'w-96', lg: 'w-[32rem]', xl: 'w-[40rem]' },
  right: { sm: 'w-80', md: 'w-96', lg: 'w-[32rem]', xl: 'w-[40rem]' },
  bottom: { sm: 'h-1/3', md: 'h-1/2', lg: 'h-2/3', xl: 'h-[80vh]' },
};

export function Drawer({ open, onOpenChange, children, title, description, position = 'right', size = 'md' }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={`fixed z-50 bg-card border-theme shadow-elevation-3 ${POSITION_CLASSES[position]} ${SIZE_CLASSES[position][size]} max-w-full flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out ${
            position === 'bottom'
              ? 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom'
              : position === 'left'
              ? 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
              : 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
          }`}
        >
          <div className="flex items-start justify-between gap-4 p-5 border-b border-theme">
            <div className="space-y-1">
              {title && <DialogPrimitive.Title className="text-lg font-bold text-primary">{title}</DialogPrimitive.Title>}
              {description && <DialogPrimitive.Description className="text-sm text-secondary">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="p-2 -mr-2 -mt-2 rounded-lg text-secondary hover:text-primary hover:bg-hover transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5 pb-safe">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DrawerClose = DialogPrimitive.Close;
