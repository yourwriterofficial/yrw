'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

const WELCOME_MSG =
  "👋 Hey there! Welcome to **YRW Support**.\n\nI'm here to assist with anything — order updates, project topic questions, file delivery, or general queries. Just type below and I'll get back to you shortly.\n\n_Typical response time: a few minutes._";

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SupportChat({ user }: { user: any }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ─── init conversation ─── */
  const initChat = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant1_id', user.id)
        .is('participant2_id', null)
        .maybeSingle();

      let chatId = existing?.id;

      if (!chatId) {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            participant1_id: user.id,
            participant2_id: null,
            last_message_preview: 'Chat started',
          })
          .select('id')
          .single();
        if (error) throw error;
        chatId = newConv.id;
      }

      setConvId(chatId);
      await loadMessages(chatId);
    } catch (err: any) {
      showToast(err.message || 'Failed to open chat', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { initChat(); }, [initChat]);

  /* ─── load messages ─── */
  const loadMessages = async (chatId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', chatId)
      .order('created_at', { ascending: true });
    if (error) { console.error(error); return; }
    setMessages(data || []);
    // mark unread from admin as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', chatId)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  };

  /* ─── realtime ─── */
  useEffect(() => {
    if (!convId) return;
    const ch = supabase
      .channel(`client-chat-${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        () => loadMessages(convId)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId]);

  /* ─── auto scroll ─── */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── send ─── */
  const sendMessage = async () => {
    if (!inputMsg.trim() || !convId || sending) return;
    const text = inputMsg.trim();
    setSending(true);
    setInputMsg('');
    try {
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        content: text,
      });
      await supabase.from('conversations').update({
        last_message_preview: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', convId);
    } catch (err: any) {
      showToast(err.message || 'Failed to send', 'error');
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ─── group messages by date ─── */
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach(m => {
    const d = formatDate(m.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === d) { last.msgs.push(m); }
    else { groupedMessages.push({ date: d, msgs: [m] }); }
  });

  /* ─── loading ─── */
  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-secondary">
      <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <span className="text-xs font-bold uppercase tracking-widest">Connecting to Support…</span>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">

      {/* ── HEADER ── */}
      <div className="bg-card border-b border-theme px-5 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black font-black shadow-md">
              <lucide.Shield className="w-5 h-5" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-sm text-primary leading-none">YRW Support Team</h3>
            <p className="text-[10px] text-emerald-500 font-bold mt-0.5 uppercase tracking-wider">● Online — replies in minutes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-secondary font-bold bg-secondary/60 px-2.5 py-1 rounded-full border border-theme">
            <lucide.Lock className="w-3 h-3 text-emerald-500" /> Encrypted
          </div>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1 bg-secondary/10">

        {/* Pinned admin welcome bubble — always shown */}
        <div className="flex items-end gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shrink-0 mb-1 shadow">
            <lucide.Shield className="w-3.5 h-3.5" />
          </div>
          <div className="max-w-[78%]">
            <div className="text-[10px] text-secondary font-bold mb-1 ml-0.5">Support Team</div>
            <div
              className="bg-card border border-theme rounded-2xl rounded-tl-none px-4 py-3 text-sm text-primary leading-relaxed shadow-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(WELCOME_MSG) }}
            />
            <div className="text-[9px] text-secondary mt-1 ml-0.5 font-mono">Pinned • Always available</div>
          </div>
        </div>

        {/* Real messages grouped by date */}
        {groupedMessages.map(group => (
          <div key={group.date}>
            {/* Date divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-theme" />
              <span className="text-[9px] text-secondary font-black uppercase tracking-widest px-2">{group.date}</span>
              <div className="flex-1 h-px bg-theme" />
            </div>

            {group.msgs.map((m, i) => {
              const isMe = m.sender_id === user.id;
              const nextSame = group.msgs[i + 1]?.sender_id === m.sender_id;
              return (
                <div key={m.id} className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : ''} ${nextSame ? 'mb-0.5' : 'mb-3'}`}>
                  {/* Avatar — show only for last in a run */}
                  <div className="w-7 shrink-0">
                    {!nextSame && !isMe && (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shadow">
                        <lucide.Shield className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {!nextSame && isMe && (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px] font-black">
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                        isMe
                          ? 'bg-emerald-500 text-black rounded-2xl rounded-br-none font-medium'
                          : 'bg-card border border-theme text-primary rounded-2xl rounded-tl-none'
                      } ${nextSame && isMe ? 'rounded-br-2xl' : ''} ${nextSame && !isMe ? 'rounded-tl-2xl' : ''}`}
                    >
                      {m.content}
                    </div>
                    {!nextSame && (
                      <div className={`flex items-center gap-1 mt-1 text-[9px] text-secondary font-mono ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span>{formatTime(m.created_at)}</span>
                        {isMe && (
                          m.is_read
                            ? <lucide.CheckCheck className="w-3 h-3 text-emerald-400" />
                            : <lucide.Check className="w-3 h-3 text-secondary" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {adminTyping && (
          <div className="flex items-end gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-black shadow shrink-0">
              <lucide.Shield className="w-3.5 h-3.5" />
            </div>
            <div className="bg-card border border-theme rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center shadow-sm">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* ── INPUT ── */}
      <div className="bg-card border-t border-theme px-4 py-3 shrink-0">
        <div className="flex items-end gap-3 bg-secondary/60 border border-theme rounded-2xl px-4 py-2 focus-within:border-emerald-500/60 transition-colors">
          <textarea
            ref={inputRef}
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-primary outline-none resize-none max-h-32 leading-relaxed placeholder:text-secondary/60 py-1"
            style={{ fieldSizing: 'content' } as any}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMsg.trim() || sending}
            className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
          >
            {sending
              ? <lucide.Loader2 className="w-4 h-4 animate-spin" />
              : <lucide.Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-[9px] text-secondary text-center mt-2 font-medium">
          Messages are end-to-end secured • Support team replies within minutes
        </p>
      </div>

    </div>
  );
}
