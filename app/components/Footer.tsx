import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-theme py-16 px-4 sm:px-6 md:px-8 pb-safe bg-card">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 text-sm border-b border-theme/60 pb-12 mb-12">
        <div className="col-span-2 space-y-4">
          <Link href="/" className="text-lg font-bold tracking-tight flex items-center gap-2 select-none group">
            <div className="w-8 h-8 bg-primary border border-theme rounded-lg flex items-center justify-center text-primary font-black text-xs group-hover:border-accent transition-colors">
              RW
            </div>
            <span className="text-primary font-bold">ResearchWriter</span>
          </Link>
          <p className="text-xs text-secondary leading-relaxed max-w-xs">
            Secure custom project pipeline scheduling for academic research, SPSS/math fieldwork, SEO creative copywriting, executive career documents, and custom software builds.
          </p>
        </div>
        <div>
          <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Services</h5>
          <ul className="space-y-3 text-xs font-medium">
            <li><Link href="/academic-writing" className="text-secondary hover:text-emerald-400 transition-colors">Academic Writing</Link></li>
            <li><Link href="/statistics-fieldwork" className="text-secondary hover:text-purple-400 transition-colors">Statistics & Fieldwork</Link></li>
            <li><Link href="/content-writing" className="text-secondary hover:text-amber-400 transition-colors">Content Writing</Link></li>
            <li><Link href="/resume-cv" className="text-secondary hover:text-blue-400 transition-colors">Executive Resumes</Link></li>
            <li><Link href="/developer" className="text-secondary hover:text-cyan-400 transition-colors">Software Development</Link></li>
          </ul>
        </div>
        <div>
          <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Buy Instantly</h5>
          <ul className="space-y-3 text-xs font-medium">
            <li><Link href="/projects" className="text-secondary hover:text-primary transition-colors">Ready-Made Projects</Link></li>
            <li><Link href="/developer/shop" className="text-secondary hover:text-primary transition-colors">Script Shop</Link></li>
            <li><Link href="/#faq" className="text-secondary hover:text-primary transition-colors">FAQ Support</Link></li>
          </ul>
        </div>
        <div>
          <h5 className="text-xs font-bold text-primary mb-4 uppercase tracking-wider">Account</h5>
          <ul className="space-y-3 text-xs font-medium">
            <li><Link href="/login" className="text-secondary hover:text-primary transition-colors">Client Login</Link></li>
            <li><Link href="/register" className="text-secondary hover:text-primary transition-colors">Register Account</Link></li>
            <li><Link href="/dashboard/client" className="text-secondary hover:text-primary transition-colors">Dashboard Vault</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-secondary gap-4">
        <p>© {new Date().getFullYear()} ResearchWriter. All rights reserved.</p>
        <div className="flex gap-6">
          <span className="text-[10px] text-secondary">Paystack Secure Gateway</span>
          <span className="text-[10px] text-secondary">Distributed Vault Escrow v2.4</span>
        </div>
      </div>
    </footer>
  );
}
