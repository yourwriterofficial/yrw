type LoadingScreenProps = {
  label?: string;
  accent?: 'emerald' | 'purple' | 'brand';
  fullScreen?: boolean;
};

const ACCENT_CLASSES: Record<'emerald' | 'purple' | 'brand', string> = {
  emerald: 'border-success/20 border-t-success',
  purple: 'border-purple-500/20 border-t-purple-500',
  brand: 'border-brand-500/20 border-t-brand-500',
};

const ACCENT_TEXT_CLASSES: Record<'emerald' | 'purple' | 'brand', string> = {
  emerald: 'text-success',
  purple: 'text-purple-500',
  brand: 'text-brand-500',
};

export default function LoadingScreen({
  label = 'Loading...',
  accent = 'brand',
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'} bg-primary text-primary flex items-center justify-center`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`w-12 h-12 border-4 rounded-full animate-spin ${ACCENT_CLASSES[accent]}`} />
        <span className={`text-xs font-black uppercase tracking-widest animate-pulse ${ACCENT_TEXT_CLASSES[accent]}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
