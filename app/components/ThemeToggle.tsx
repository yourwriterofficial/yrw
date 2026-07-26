'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({
  className = 'flex items-center gap-2 w-full p-2 rounded-xl text-secondary hover:bg-white/5 hover:text-primary transition text-sm font-bold',
  compact = false,
}: { className?: string; compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={compact ? 'p-2 rounded-lg text-secondary hover:bg-white/5 hover:text-primary transition shrink-0' : className}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      type="button"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400" />
      )}
      {!compact && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
}
