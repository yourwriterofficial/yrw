'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, LineChart, PenTool, Briefcase, ArrowRight, Terminal, Library } from 'lucide-react';
import OrderCategoryNav from '@/app/components/OrderCategoryNav';

import { getEffectiveUser } from '@/lib/impersonate';

export default function SelectServicePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { user, profile } = await getEffectiveUser();
      if (!user) return router.push('/login');
      setUser(user);
      setProfile(profile);
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary py-12 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <OrderCategoryNav />
        <Link href="/dashboard/client" className="inline-flex items-center gap-2 text-secondary hover:text-emerald-400 text-sm font-bold mb-8 mt-6 transition">
          <ArrowRight className="w-4 h-4 rotate-180" /> Back to Dashboard
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-primary mb-4">What would you like to order?</h1>
          <p className="text-secondary">Your account details will be pre‑filled automatically.</p>
          <p className="text-xs text-emerald-400 mt-2">Logged in as: {profile?.full_name || user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Academic Card */}
          <Link href="/dashboard/client/order/new/academic" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-emerald-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Standard Academic Research</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">Essays, term papers, dissertations – with automated volume discounts and plagiarism checks.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ Instant dynamic quotes</li>
              <li className="flex items-center gap-2 break-words">✅ APA, MLA, Harvard formatting</li>
            </ul>
          </Link>

          {/* Statistics Card */}
          <Link href="/dashboard/client/order/new/statistics" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-purple-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-purple-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
              <LineChart className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Statistics, Maths, Financial & Fieldwork</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">SPSS analysis, mathematical modelling, financial computation – custom add‑ons available.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ Add‑on toggles (Slides, Data)</li>
              <li className="flex items-center gap-2 break-words">✅ Bespoke emergency pricing</li>
            </ul>
          </Link>

          {/* Content Card */}
          <Link href="/dashboard/client/order/new/content" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-amber-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
              <PenTool className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Content & Creative Writing</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">SEO articles, eBooks, web copy – tailored tone and style.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ SEO‑optimized structuring</li>
              <li className="flex items-center gap-2 break-words">✅ Commercial copyright transfer</li>
            </ul>
          </Link>

          {/* Resume Card */}
          <Link href="/dashboard/client/order/new/resume" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-blue-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-blue-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
              <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Executive CVs & Resumes</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">ATS‑friendly resumes, cover letters, LinkedIn optimization.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ ATS compatibility</li>
              <li className="flex items-center gap-2 break-words">✅ Industry‑specific keywords</li>
            </ul>
          </Link>

          {/* Ready-made Project Materials Card */}
          <Link href="/projects" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-emerald-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
              <Library className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Ready-made Project Materials</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">Browse 3,000+ ready-made topics across every department — instant pricing, delivered to your vault.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ Chapters 1–5, MS Word</li>
              <li className="flex items-center gap-2 break-words">✅ Fast delivery to Secure Vault</li>
            </ul>
          </Link>

          {/* Software Dev Card */}
          <Link href="/dashboard/client/order/new/dev" className="group block p-6 md:p-8 rounded-[32px] bg-secondary border border-theme hover:border-cyan-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-cyan-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20">
              <Terminal className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words text-primary">Full Stack & Custom Software</h3>
            <p className="text-xs md:text-sm text-secondary mb-6 leading-relaxed break-words">Web apps, database design, MVP prototyping, API integrations.</p>
            <ul className="space-y-2 text-xs font-medium text-secondary">
              <li className="flex items-center gap-2 break-words">✅ Database, payments & CI/CD add-ons</li>
              <li className="flex items-center gap-2 break-words">✅ Interactive staging demos</li>
            </ul>
          </Link>
        </div>
      </div>
    </div>
  );
}