'use client';

import React from 'react';
import * as lucide from 'lucide-react';

export default function SupportChat({ user }: { user?: any }) {
  const email = user?.email || '';
  const text = encodeURIComponent(`Hello YRW Support, I need assistance with my account (${email}).`);

  return (
    <div className="p-8 text-center space-y-4 max-w-md mx-auto my-auto">
      <div className="w-14 h-14 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl flex items-center justify-center text-[#25D366] mx-auto">
        <lucide.MessageCircle className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-black text-primary">Chat with Us on WhatsApp</h3>
      <p className="text-xs text-secondary leading-relaxed">
        Our customer support team is active on WhatsApp to assist with your research project, payments, or file deliveries.
      </p>
      <a
        href={`https://wa.me/2348121443666?text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-black text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg shadow-[#25D366]/10 cursor-pointer"
      >
        <lucide.Send className="w-4 h-4" /> Open WhatsApp Desk
      </a>
    </div>
  );
}
