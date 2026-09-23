'use client';

import React from 'react';
import * as lucide from 'lucide-react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/app/components/ui/PageHeader';

export default function AdminChatPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Support Desk"
        description="Live client communication is now centralized on the official WhatsApp desk"
      />

      <div className="bg-card border border-theme rounded-3xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl flex items-center justify-center text-[#25D366] mx-auto">
          <lucide.MessageCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="text-xl font-black text-primary">In-App Chat Transitioned to WhatsApp</h2>
          <p className="text-xs text-secondary leading-relaxed">
            All client questions, custom project briefings, and payment receipt verifications are now routed directly to WhatsApp for real-time response and zero server overhead.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-secondary/30 border border-theme max-w-sm mx-auto text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-secondary font-medium">WhatsApp Hotline:</span>
            <span className="font-bold text-primary">+234 812 144 3666</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary font-medium">Desk Account:</span>
            <span className="font-bold text-primary">YourWriter Operations</span>
          </div>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <a
            href="https://wa.me/2348121443666"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-[#25D366]/10"
          >
            <lucide.Send className="w-4 h-4" /> Open WhatsApp Desk
          </a>
          <button
            onClick={() => router.push('/admin')}
            className="px-5 py-3 bg-secondary hover:bg-hover border border-theme text-xs font-bold text-primary rounded-xl transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
