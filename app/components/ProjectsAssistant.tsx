'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Bot, User as UserIcon, ArrowLeft } from 'lucide-react';

type Msg = { role: 'bot' | 'user'; text: string };

/**
 * Page-scoped assistant for /projects ONLY. It answers questions about the
 * ready-made project materials on this page. If the visitor actually wants a
 * plagiarism-free / AI-free custom write-up, it redirects them to the main
 * writing service instead of trying to sell them a ready-made material.
 */
export default function ProjectsAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [step, setStep] = useState<'menu' | 'plagiarism'>('menu');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, open]);

  const say = (text: string) => setHistory(h => [...h, { role: 'bot', text }]);
  const reply = (text: string) => setHistory(h => [...h, { role: 'user', text }]);

  const openIt = () => {
    setOpen(true);
    if (history.length === 0) {
      setTimeout(() => say("Hi! I'm the Project Materials assistant. I can help you find and buy a ready-made project on this page. What do you need?"), 150);
    }
  };

  const reset = () => { setHistory([]); setStep('menu'); setTimeout(() => say("How can I help with project materials?"), 120); };

  const answer = (q: string) => {
    reply(q);
    if (q === 'How does it work?') {
      say("Browse or search 3,000+ topics by department and level (BSc/MSc/PhD). Click “Get”, pick any add-ons, accept the terms, and pay. Your material (Chapters 1–5, MS Word) lands in your secure vault. Working hours are 8am–7pm and delivery is within 4 hours.");
      setStep('menu');
    } else if (q === 'What are the prices?') {
      say("BSc/HND ₦3,999 · MSc/PGD ₦4,500 · PhD ₦10,000. Optional add-ons (plagiarism report, SPSS analysis, slides, express delivery, etc.) are shown at checkout with their prices.");
      setStep('menu');
    } else if (q === "Can't find my topic?") {
      say("Use the “Check Availability” box near the top — type your topic, choose your level, and it'll show as available with the price. Every topic can be prepared.");
      setStep('menu');
    } else if (q === 'Is it plagiarism-free / AI-free?') {
      say("Honest answer: these are ready-made materials, so we do NOT check or guarantee plagiarism/similarity or AI-detection levels on them. If you need genuinely plagiarism-free, AI-free, custom-written work, that's our main writing service — not this page.");
      setStep('plagiarism');
    } else if (q === 'Yes, take me to custom writing') {
      say("Great — sending you to our academic writing service, where every project is written from scratch with plagiarism & AI reports.");
      setTimeout(() => router.push('/order/academic'), 800);
    } else if (q === 'No, a ready-made one is fine') {
      say("Perfect — just browse the catalogue, hit “Get”, and check out. Anything else?");
      setStep('menu');
    }
  };

  const options = step === 'plagiarism'
    ? ['Yes, take me to custom writing', 'No, a ready-made one is fine']
    : ['How does it work?', 'What are the prices?', "Can't find my topic?", 'Is it plagiarism-free / AI-free?'];

  return (
    <>
      {!open && (
        <button onClick={openIt} className="fixed bottom-6 left-6 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:brightness-110 transition" aria-label="Open projects assistant">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-wide hidden sm:inline">Materials Help</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 left-6 z-50 w-[92vw] max-w-sm bg-card border border-theme rounded-[24px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '78vh' }}>
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /><span className="text-xs font-black uppercase tracking-wide">Project Materials</span></div>
            <div className="flex items-center gap-1">
              {history.length > 0 && <button onClick={reset} className="p-1.5 hover:bg-white/10 rounded-lg"><ArrowLeft className="w-4 h-4" /></button>}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[140px]">
            {history.map((m, i) => (
              <div key={i} className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === 'bot' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-secondary text-secondary'}`}>{m.role === 'bot' ? <Bot className="w-3.5 h-3.5" /> : <UserIcon className="w-3.5 h-3.5" />}</div>
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed max-w-[82%] ${m.role === 'bot' ? 'bg-secondary text-primary rounded-tl-sm' : 'bg-emerald-500/10 text-primary rounded-tr-sm'}`}>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-theme shrink-0 flex flex-col gap-2">
            {options.map(o => (
              <button key={o} onClick={() => answer(o)} className="text-left px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition">{o}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
