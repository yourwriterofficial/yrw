'use client';

import Link from 'next/link';
import { Terminal, Shield, ArrowRight, Code2, ShoppingBag } from 'lucide-react';

export default function DevelopaFooter() {
  return (
    <footer className="border-t border-theme bg-primary/40 text-primary py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand & Mission */}
        <div className="md:col-span-2 space-y-4">
          <Link
            href="/developer"
            className="text-[15px] font-semibold tracking-tight inline-flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent font-mono font-bold text-xs group-hover:border-accent/60 transition-colors">
              <Terminal className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-primary font-black text-lg tracking-tight">developa</span>
              <span className="text-accent font-bold text-sm tracking-tight">.me</span>
            </div>
          </Link>
          <p className="text-secondary text-sm max-w-md leading-relaxed">
            Full stack web applications, mobile builds, scalable backend APIs, database architecture, and ready-made automation scripts. Complete source code and IP transfer upon completion.
          </p>
          <div className="flex items-center gap-2 text-xs text-secondary pt-1">
            <Shield className="w-3.5 h-3.5 text-accent" />
            <span>Guaranteed IP transfer & milestone-based delivery</span>
          </div>
        </div>

        {/* Engineering Services */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Engineering</h3>
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <Link href="/developer#capabilities" className="hover:text-accent transition-colors">
                Web Applications
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-accent transition-colors">
                Mobile App Development
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-accent transition-colors">
                API & Payment Integrations
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-accent transition-colors">
                Database Architecture
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-accent transition-colors">
                MVP Prototypes
              </Link>
            </li>
          </ul>
        </div>

        {/* Marketplace & Client Portal */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Marketplace & Hub</h3>
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <Link href="/developer/shop" className="hover:text-accent transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                Script Catalogue
              </Link>
            </li>
            <li>
              <Link href="/developer#quote" className="hover:text-accent transition-colors flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-accent" />
                Submit Project Brief
              </Link>
            </li>
            <li>
              <Link href="/dashboard/client?tab=scripts" className="hover:text-accent transition-colors">
                Client Script Downloads
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-accent transition-colors">
                Client Sign In
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-theme flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary">
        <p>© {new Date().getFullYear()} developa.me — an engineering division of ResearchWriter. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/developer#quote" className="text-accent hover:text-accent transition-colors font-medium flex items-center gap-1">
            <span>Hire Dev Lead</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
