import Link from 'next/link';

const SERVICES = [
  { href: '/#academic', label: 'Academic writing' },
  { href: '/#statistics', label: 'Statistics & fieldwork' },
  { href: '/#content', label: 'Content writing' },
  { href: '/#resume', label: 'CVs & resumes' },
  { href: '/developer', label: 'Software (developa.me)' },
];

export default function Footer() {
  return (
    <footer className="border-t border-theme pt-16 pb-safe bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-12 border-b border-theme">
          <div className="space-y-4">
            <Link href="/" className="text-lg font-bold tracking-tight flex items-center gap-2 select-none group">
              <div className="w-8 h-8 bg-secondary border border-theme rounded-lg flex items-center justify-center text-primary font-black text-xs group-hover:border-accent transition-colors">
                RW
              </div>
              <span className="text-primary font-bold">ResearchWriter</span>
            </Link>
            <p className="text-xs text-secondary leading-relaxed max-w-xs">
              Academic writing, statistics and fieldwork, content writing, CVs and software, for clients across Nigeria.
            </p>
          </div>

          <div>
            <h5 className="text-[11px] font-bold text-primary mb-4 uppercase tracking-widest">Services</h5>
            <ul className="space-y-3 text-xs font-medium">
              {SERVICES.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-secondary hover:text-primary transition-colors">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-[11px] font-bold text-primary mb-4 uppercase tracking-widest">Marketplace</h5>
            <ul className="space-y-3 text-xs font-medium">
              <li><Link href="/projects" className="text-secondary hover:text-primary transition-colors">Ready-Made Projects</Link></li>
              <li><Link href="/developer/shop" className="text-secondary hover:text-primary transition-colors">Script Shop</Link></li>
              <li><Link href="/advertise" className="text-secondary hover:text-primary transition-colors">Advertise with us</Link></li>
              <li><Link href="/#faq" className="text-secondary hover:text-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>

          <div>
            <h5 className="text-[11px] font-bold text-primary mb-4 uppercase tracking-widest">Account</h5>
            <ul className="space-y-3 text-xs font-medium">
              <li><Link href="/login" className="text-secondary hover:text-primary transition-colors">Log in</Link></li>
              <li><Link href="/register" className="text-secondary hover:text-primary transition-colors">Create account</Link></li>
              <li><Link href="/dashboard/client" className="text-secondary hover:text-primary transition-colors">My dashboard</Link></li>
            </ul>
          </div>
        </div>

        <div className="py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-secondary gap-4">
          <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
