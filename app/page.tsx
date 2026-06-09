'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ShieldCheck, BarChart3, Fingerprint, Settings } from 'lucide-react';

const testimonials = [
  { name: "Oluwaseun A., MSc", uni: "University of Ibadan", text: "The internal audit caught things my supervisor missed. Absolutely flawless synthesis." },
  { name: "Dr. Sarah Jenkins", uni: "King's College London", text: "I needed high-level theoretical editing to bypass AI detection protocols. They delivered perfectly." },
  { name: "Chioma E., LLM", uni: "UNIZIK", text: "Their adherence to the NALT citation guide was impeccable. Saved my legal dissertation." },
  { name: "Wei Chen, MA", uni: "University of Toronto", text: "Fast, incredibly secure, and the human prose was completely undetectable by Turnitin." },
  { name: "Michael T., PhD Candidate", uni: "Obafemi Awolowo University", text: "The vault sync and zero-trace policy gave me total peace of mind. Excellent data analysis." },
];

export default function LandingPage() {
  const router = useRouter();
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [time, setTime] = useState('--:--');

  // Handle Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Testimonial Rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Inter'] overflow-x-hidden">
      {/* Navigation */}
      <nav className="p-6 border-b border-white/5 sticky top-0 bg-[#050505]/90 z-50 flex justify-between items-center backdrop-blur-md flex-wrap gap-4">
        <div className="font-black text-xl italic tracking-tighter cursor-pointer">YourWriterOfficial</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest flex-wrap">
            <button className="hover:text-emerald-500 transition px-3 py-1 rounded-full bg-white/5">Home</button>
            <button onClick={() => router.push('/order')} className="hover:text-emerald-500 transition px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Start Order</button>
            <a href="https://wa.me/2348121443666" target="_blank" rel="noreferrer" className="hover:text-emerald-500 transition px-3 py-1 rounded-full bg-white/5">Contact Us</a>
            <button onClick={() => router.push('/login')} className="hover:text-emerald-500 transition px-3 py-1 rounded-full bg-white/5 border border-white/10">Client Login</button>
          </div>
          <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <Settings className="w-4 h-4 text-slate-400" />
            <div className="w-[1px] h-4 bg-white/20" />
            <div className="flex flex-col text-[8px] font-bold tracking-widest uppercase text-slate-400">
              <div className="flex items-center gap-1">
                <span>{time}</span>
                <span className="text-slate-400">Local</span>
              </div>
              <span className="text-emerald-500">HQ (WAT)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Secured Sync</span>
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-12 px-6 max-w-6xl">
        {/* Hero Section */}
        <section className="text-center py-20 mb-12">
          <div className="inline-block bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full mb-8 text-[10px] font-black uppercase tracking-widest">
            Elite Academic Syndicate
          </div>
          <h1 className="text-7xl md:text-9xl font-black mb-8 tracking-tighter leading-[0.85]">
            Research.<br /><span className="text-emerald-500 italic">Human Only.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-400 mb-12 text-lg leading-relaxed text-center font-medium">
            Raw intellectual labor for MSc and PhD scholars. We bypass AI detection protocols via deep human auditing.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-24">
            <button 
              onClick={() => router.push('/order')} 
              className="bg-[#1DB954] text-black font-black uppercase text-[11px] tracking-[1.5px] px-12 py-5 rounded-full shadow-xl shadow-emerald-500/10 hover:scale-105 transition"
            >
              Start Normal Order
            </button>
            <button 
              onClick={() => router.push('/order')} 
              className="bg-white/5 border border-white/10 px-12 py-5 rounded-full font-black text-[11px] uppercase tracking-widest hover:bg-white/10 transition"
            >
              Start Custom Proposal
            </button>
          </div>
        </section>

        {/* Services Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          <div className="p-10 bg-white/5 backdrop-blur-md rounded-[40px] border border-white/5">
            <BookOpen className="w-10 h-10 text-emerald-500 mb-6" />
            <h3 className="text-xl font-black mb-4 uppercase text-xs tracking-widest">Dissertations</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Full MSc & PhD support. Pure human intelligence with deep theoretical synthesis.</p>
          </div>
          <div className="p-10 bg-white/5 backdrop-blur-md rounded-[40px] border border-white/5">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mb-6" />
            <h3 className="text-xl font-black mb-4 uppercase text-xs tracking-widest">Audit & Polishing</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Reworking AI-flagged content into authentic human prose.</p>
          </div>
          <div className="p-10 bg-white/5 backdrop-blur-md rounded-[40px] border border-white/5">
            <BarChart3 className="w-10 h-10 text-emerald-500 mb-6" />
            <h3 className="text-xl font-black mb-4 uppercase text-xs tracking-widest">Data Analysis</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Specialized SPSS and Stata modeling for high-impact research findings.</p>
          </div>
        </div>

        {/* Confidentiality Section */}
        <div className="mb-24 p-12 bg-white/5 backdrop-blur-md rounded-[50px] border border-emerald-500/20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-black mb-6 tracking-tight leading-tight">The Confidentiality <br /><span className="text-emerald-500 italic">Stratum.</span></h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-10">Your identity is protected by an encrypted briefing protocol. Files are synced to a private Drive Vault with a strict Zero-Trace policy.</p>
            <div className="flex gap-4">
              <div className="bg-white/5 p-6 rounded-[30px] w-full text-center">
                <div className="text-2xl font-black">100%</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Anonymity</div>
              </div>
              <div className="bg-white/5 p-6 rounded-[30px] w-full text-center border border-white/5">
                <div className="text-2xl font-black">Vault</div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sync</div>
              </div>
            </div>
          </div>
          <div className="bg-emerald-500/5 p-12 rounded-[50px] border border-emerald-500/10 text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <Fingerprint className="text-emerald-500 w-10 h-10" />
            </div>
            <h4 className="font-black mb-2 uppercase text-xs tracking-widest">Human Intelligence Only</h4>
            <p className="text-xs text-slate-500">Adhering to raw, critical academic research standards.</p>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-24 py-12 bg-white/5 backdrop-blur-md rounded-[50px] border border-emerald-500/10 text-center relative overflow-hidden">
          <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-6">Global & Local Verification</div>
          <div className="min-h-[120px] flex items-center justify-center px-8">
            <div className="transition-opacity duration-500 animate-in fade-in zoom-in-95" key={currentTestimonial}>
              <p className="text-lg md:text-2xl font-medium italic text-white mb-4 leading-relaxed max-w-3xl mx-auto">
                "{testimonials[currentTestimonial].text}"
              </p>
              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest">{testimonials[currentTestimonial].name}</p>
              <p className="text-[10px] text-slate-400">{testimonials[currentTestimonial].uni}</p>
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentTestimonial(i)}
                className={`h-2 rounded-full transition-all duration-300 ${i === currentTestimonial ? 'bg-emerald-500 w-6' : 'bg-white/20 w-2'}`}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}