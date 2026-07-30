interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const STATUS_CLASSES: Record<string, string> = {
  online: 'bg-success',
  offline: 'bg-text-muted',
  away: 'bg-warning',
  busy: 'bg-danger',
};

export function Avatar({ src, name = '', size = 'md', status, className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover border border-theme bg-secondary`}
        />
      ) : (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full border border-theme bg-secondary text-primary font-bold flex items-center justify-center`}
          aria-label={name || 'Avatar'}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${STATUS_CLASSES[status]}`}
        />
      )}
    </div>
  );
}
