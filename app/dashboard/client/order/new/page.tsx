'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, LineChart, PenTool, Briefcase, ArrowRight } from 'lucide-react';

export default function SelectServicePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(profile);
      setLoading(false);
    };
    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] py-12 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">What would you like to order?</h1>
          <p className="text-zinc-400">Your account details will be pre‑filled automatically.</p>
          <p className="text-xs text-emerald-400 mt-2">Logged in as: {profile?.full_name || user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academic Card */}
          <Link href="/dashboard/client/order/new/academic" className="group block p-6 md:p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-emerald-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-emerald-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words">Standard Academic Research</h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6 leading-relaxed break-words">Essays, term papers, dissertations – with automated volume discounts and plagiarism checks.</p>
            <ul className="space-y-2 text-xs font-medium text-zinc-500">
              <li className="flex items-center gap-2 break-words">✅ Instant dynamic quotes</li>
              <li className="flex items-center gap-2 break-words">✅ APA, MLA, Harvard formatting</li>
            </ul>
          </Link>

          {/* Custom Card */}
          <Link href="/dashboard/client/order/new/custom" className="group block p-6 md:p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-purple-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-purple-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
              <LineChart className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words">Complex Data & Fieldwork</h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6 leading-relaxed break-words">SPSS analysis, surveys, statistical modelling – custom add‑ons available.</p>
            <ul className="space-y-2 text-xs font-medium text-zinc-500">
              <li className="flex items-center gap-2 break-words">✅ Add‑on toggles (Slides, Data)</li>
              <li className="flex items-center gap-2 break-words">✅ Bespoke emergency pricing</li>
            </ul>
          </Link>

          {/* Content Card */}
          <Link href="/dashboard/client/order/new/content" className="group block p-6 md:p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-amber-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-amber-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
              <PenTool className="w-5 h-5 md:w-6 md:h-6 text-amber-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words">Content & Creative Writing</h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6 leading-relaxed break-words">SEO articles, eBooks, web copy – tailored tone and style.</p>
            <ul className="space-y-2 text-xs font-medium text-zinc-500">
              <li className="flex items-center gap-2 break-words">✅ SEO‑optimized structuring</li>
              <li className="flex items-center gap-2 break-words">✅ Commercial copyright transfer</li>
            </ul>
          </Link>

          {/* Resume Card */}
          <Link href="/dashboard/client/order/new/resume" className="group block p-6 md:p-8 rounded-[32px] bg-black border border-zinc-800 hover:border-blue-500/50 transition duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-0 group-hover:opacity-100 transition transform translate-x-4 group-hover:translate-x-0"><ArrowRight className="text-blue-500 w-5 h-5" /></div>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
              <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <h3 className="text-lg md:text-xl font-black mb-3 break-words">Executive CVs & Resumes</h3>
            <p className="text-xs md:text-sm text-zinc-400 mb-6 leading-relaxed break-words">ATS‑friendly resumes, cover letters, LinkedIn optimization.</p>
            <ul className="space-y-2 text-xs font-medium text-zinc-500">
              <li className="flex items-center gap-2 break-words">✅ ATS compatibility</li>
              <li className="flex items-center gap-2 break-words">✅ Industry‑specific keywords</li>
            </ul>
          </Link>
        </div>
      </div>
    </div>
  );
}