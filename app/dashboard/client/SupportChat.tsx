'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function SupportChat({ user }: { user: any }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;

    // Find or create Support Conversation
    const initChat = async () => {
      try {
        setLoading(true);
        // Look for existing support thread
        const { data: existing, error: findError } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant1_id', user.id)
          .is('participant2_id', null)
          .maybeSingle();

        if (findError) throw findError;

        if (existing) {
          setConvId(existing.id);
          await loadMessages(existing.id);
        } else {
          // Create new support thread
          const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert({
              participant1_id: user.id,
              participant2_id: null,
              last_message_preview: 'Support chat started.',
            })
            .select('id')
            .single();

          if (createError) throw createError;
          setConvId(newConv.id);
        }
      } catch (err: any) {
        console.error('Failed to init chat support:', err);
        showToast(err.message || 'Failed to initialize chat support.', 'error');
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [user?.id]);

  const loadMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', chatId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
    } catch (e: any) {
      console.error('Failed to load messages:', e);
    }
  };

  // Realtime messages subscription
  useEffect(() => {
    if (!convId) return;

    const channel = supabase
      .channel(`support-chat-${convId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        () => {
          loadMessages(convId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [convId]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !convId || sending) return;

    const text = inputMsg.trim();
    setSending(true);
    setInputMsg('');

    try {
      // 1. Insert message
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        content: text,
      });
      if (msgError) throw msgError;

      // 2. Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', convId);

    } catch (err: any) {
      showToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-secondary">
        <lucide.Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
        <span className="text-xs font-bold uppercase tracking-widest">Initializing Support Pipeline...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-secondary/25">
      {/* HEADER */}
      <div className="bg-card border-b border-theme p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 font-black">
            <lucide.Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
              YRW Support Desk <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h3>
            <p className="text-[10px] text-secondary font-semibold">Typical reply time: within a few minutes</p>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <lucide.MessageSquareDashed className="w-12 h-12 text-secondary/60" />
            <div>
              <p className="text-sm font-bold text-primary">No messages yet</p>
              <p className="text-xs text-secondary mt-0.5">Introduce your topic or request. Support is online!</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm space-y-1 relative ${
                    isMe
                      ? 'bg-emerald-500 text-black rounded-tr-none'
                      : 'bg-card border border-theme text-primary rounded-tl-none'
                  }`}
                >
                  <p className="leading-relaxed font-medium whitespace-pre-wrap">{m.content}</p>
                  <div className="flex items-center justify-end gap-1 text-[9px] opacity-70 font-semibold">
                    <span>{formatTime(m.created_at)}</span>
                    {isMe && (
                      m.is_read ? <lucide.CheckCheck className="w-3.5 h-3.5" /> : <lucide.Check className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* FOOTER INPUT */}
      <form onSubmit={sendMessage} className="p-4 bg-card border-t border-theme flex gap-3 items-center">
        <input
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder="Type your support request or project briefing details..."
          className="flex-1 bg-secondary border border-theme rounded-xl px-4 py-3 text-sm text-primary outline-none focus:border-emerald-500 transition"
        />
        <button
          type="submit"
          disabled={!inputMsg.trim() || sending}
          className="w-12 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition disabled:opacity-40 disabled:hover:bg-emerald-500 cursor-pointer shrink-0"
        >
          {sending ? (
            <lucide.Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <lucide.Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
