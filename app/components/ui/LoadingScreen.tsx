type LoadingScreenProps = {
  label?: string;
  accent?: 'emerald' | 'purple';
  fullScreen?: boolean;
};

export default function LoadingScreen({
  label = 'Loading...',
  accent = 'emerald',
  fullScreen = true,
}: LoadingScreenProps) {
  const isPurple = accent === 'purple';

  return (
    <div
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[40vh]'} bg-primary text-primary flex items-center justify-center`}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`w-12 h-12 border-4 rounded-full animate-spin ${
            isPurple ? 'border-purple-500/20 border-t-purple-500' : 'border-emerald-500/20 border-t-emerald-500'
          }`}
        />
        <span
          className={`text-xs font-black uppercase tracking-widest animate-pulse ${
            isPurple ? 'text-purple-500' : 'text-emerald-500'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
