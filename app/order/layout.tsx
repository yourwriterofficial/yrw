import Header from '@/app/components/Header';

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-primary text-primary flex flex-col">
      <Header />
      <div className="pt-16 flex-1 flex flex-col">{children}</div>
    </div>
  );
}
