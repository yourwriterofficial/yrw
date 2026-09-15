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
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs group-hover:border-cyan-400/60 transition-colors">
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-primary font-black text-lg tracking-tight">developa</span>
              <span className="text-cyan-400 font-bold text-sm tracking-tight">.me</span>
            </div>
          </Link>
          <p className="text-secondary text-sm max-w-md leading-relaxed">
            Full stack web applications, mobile builds, scalable backend APIs, database architecture, and ready-made automation scripts. Complete source code and IP transfer upon completion.
          </p>
          <div className="flex items-center gap-2 text-xs text-secondary pt-1">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guaranteed IP transfer & milestone-based delivery</span>
          </div>
        </div>

        {/* Engineering Services */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Engineering</h3>
          <ul className="space-y-2 text-sm text-secondary">
            <li>
              <Link href="/developer#capabilities" className="hover:text-cyan-400 transition-colors">
                Web Applications
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-cyan-400 transition-colors">
                Mobile App Development
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-cyan-400 transition-colors">
                API & Payment Integrations
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-cyan-400 transition-colors">
                Database Architecture
              </Link>
            </li>
            <li>
              <Link href="/developer#capabilities" className="hover:text-cyan-400 transition-colors">
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
              <Link href="/developer/shop" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                Script Catalogue
              </Link>
            </li>
            <li>
              <Link href="/order/dev" className="hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                Submit Project Brief
              </Link>
            </li>
            <li>
              <Link href="/dashboard/client?tab=scripts" className="hover:text-cyan-400 transition-colors">
                Client Script Downloads
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-cyan-400 transition-colors">
                Client Sign In
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-theme flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary">
        <p>© {new Date().getFullYear()} developa.me. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <Link href="/order/dev" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium flex items-center gap-1">
            <span>Hire Dev Lead</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
