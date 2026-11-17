'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DevelopaMark } from '@/app/components/DevelopaMark';

export default function DevelopaFooter() {
  return (
    <footer className="border-t border-theme bg-primary/40 text-primary py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2 space-y-4">
          <Link
            href="/developer"
            className="text-[15px] font-semibold tracking-tight inline-flex items-center gap-2.5 group"
          >
            <DevelopaMark className="w-8 h-8 rounded-lg" />
            <div className="flex items-baseline gap-0.5">
              <span className="text-primary font-black text-lg tracking-tight">developa</span>
              <span className="text-accent font-bold text-sm tracking-tight">.me</span>
            </div>
          </Link>
          <p className="text-secondary text-sm max-w-md leading-relaxed">
            Create an online store, portfolio, blog or community without writing a line of code. Pick a theme, add your content and go live on your own address.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Product</h3>
          <ul className="space-y-2 text-sm text-secondary">
            <li><Link href="/developer/templates" className="hover:text-accent transition-colors">Templates</Link></li>
            <li><Link href="/developer#plans" className="hover:text-accent transition-colors">Pricing</Link></li>
            <li><Link href="/developer#start" className="hover:text-accent transition-colors">Create a site</Link></li>
            <li><Link href="/forums" className="hover:text-accent transition-colors">Community forums</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Account</h3>
          <ul className="space-y-2 text-sm text-secondary">
            <li><Link href="/developer/manage" className="hover:text-accent transition-colors">Site admin</Link></li>
            <li><Link href="/login" className="hover:text-accent transition-colors">Sign in</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-theme flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-secondary">
        <p>© {new Date().getFullYear()} developa.me. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-accent transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-accent transition-colors">Privacy</Link>
          <a href="mailto:support@developa.me" className="hover:text-accent transition-colors">Contact</a>
        </div>
        <Link href="/developer#start" className="text-accent transition-colors font-medium flex items-center gap-1">
          <span>Start free</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </footer>
  );
}
