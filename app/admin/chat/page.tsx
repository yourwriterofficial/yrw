'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';

interface Conversation {
  id: string;
  participant1_id: string;
  last_message_at: string;
  last_message_preview: string;
  updated_at: string;
  // joined fields
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function AdminChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminUser, setAdminUser] = useState<any>(null);
  
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get logged in admin profile
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setAdminUser(data.user);
    });

    loadConversations();

    // Subscribe to all conversation changes
    const convChannel = supabase
      .channel('admin-convs-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, []);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, profiles:participant1_id(full_name, email)')
        .is('participant2_id', null)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (e: any) {
      console.error('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark incoming messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', chatId)
        .neq('sender_id', adminUser?.id)
        .eq('is_read', false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Realtime subscription for selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    loadMessages(selectedConv.id);

    const msgChannel = supabase
      .channel(`admin-messages-${selectedConv.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConv.id}` },
        () => {
          loadMessages(selectedConv.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConv]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !selectedConv || !adminUser || sending) return;

    const text = inputMsg.trim();
    setSending(true);
    setInputMsg('');

    try {
      // 1. Insert message
      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: selectedConv.id,
        sender_id: adminUser.id,
        content: text,
      });
      if (msgErr) throw msgErr;

      // 2. Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedConv.id);

      // Trigger notifications asynchronously
      fetch('/api/support/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConv.id, messageText: text, senderId: adminUser.id })
      }).catch(e => console.warn('Notification trigger failed', e));

      // Refresh conversations list
      loadConversations();
    } catch (err: any) {
      showToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-primary overflow-hidden">

      {/* LEFT: CONVERSATIONS LIST */}
      <aside className={`${selectedConv ? 'hidden md:flex' : 'flex w-full md:w-80'} border-r border-theme bg-secondary/30 flex-col shrink-0`}>
        <div className="p-4 border-b border-theme space-y-3">
          <div>
            <h2 className="font-black text-sm text-primary uppercase tracking-widest flex items-center gap-2">
              <lucide.MessageSquare className="w-5 h-5 text-purple-500" /> Support Queue
            </h2>
            <p className="text-[10px] text-secondary mt-1">Live customer support conversations</p>
          </div>
          
          <div className="relative">
            <lucide.Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-secondary border border-theme rounded-xl pl-9 pr-3 py-2 text-xs text-primary outline-none focus:border-purple-500 transition font-bold"
            />
            {convSearch && (
              <button 
                onClick={() => setConvSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition"
              >
                <lucide.X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-theme/40">
          {loading ? (
            <div className="p-8 text-center text-xs text-secondary flex items-center justify-center gap-2">
              <lucide.Loader2 className="w-4 h-4 animate-spin text-purple-500" /> Loading queues...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-secondary">No support conversations found.</div>
          ) : (() => {
            const filtered = conversations.filter(conv => {
              const q = convSearch.toLowerCase().trim();
              if (!q) return true;
              return (
                (conv.profiles?.full_name || 'Guest Client').toLowerCase().includes(q) ||
                (conv.profiles?.email || '').toLowerCase().includes(q)
              );
            });
            if (filtered.length === 0) {
              return <div className="p-8 text-center text-xs text-secondary">No matching clients found.</div>;
            }
            return filtered.map(conv => {
              const active = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left p-4 transition flex flex-col gap-1 border-l-4 ${
                    active 
                      ? 'bg-purple-500/5 border-purple-500' 
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start w-full gap-2">
                    <span className="font-bold text-sm text-primary truncate">
                      {conv.profiles?.full_name || 'Guest Client'}
                    </span>
                    <span className="text-[9px] text-secondary font-mono shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <span className="text-xs text-secondary truncate">{conv.profiles?.email}</span>
                  <p className="text-[11px] text-secondary mt-1 line-clamp-1 italic font-medium">
                    {conv.last_message_preview}
                  </p>
                </button>
              );
            });
          })()}
        </div>
      </aside>

      {/* RIGHT: ACTIVE THREAD */}
      <main className={`${!selectedConv ? 'hidden md:flex' : 'flex w-full md:flex-1'} flex-col h-full bg-secondary/15`}>
        {selectedConv ? (
          <div className="flex-grow flex flex-col h-full overflow-hidden">
            {/* Thread Header */}
            <div className="bg-card border-b border-theme p-4 flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedConv(null)}
                  className="md:hidden p-1 -ml-1 text-secondary hover:text-primary transition shrink-0"
                >
                  <lucide.ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-primary truncate">
                    {selectedConv.profiles?.full_name || 'Guest Client'}
                  </h3>
                  <p className="text-[10px] text-secondary mt-0.5 truncate">{selectedConv.profiles?.email}</p>
                </div>
              </div>
            </div>

            {/* Thread Messages */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-secondary">
                  <lucide.Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.sender_id === adminUser?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl p-3 text-sm space-y-1 ${
                          isMe
                            ? 'bg-purple-500 text-white rounded-tr-none'
                            : 'bg-card border border-theme text-primary rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        <div className="text-[9px] text-right opacity-60 font-semibold">
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>

            {/* Reply Input Form */}
            <form onSubmit={sendReply} className="p-4 bg-card border-t border-theme flex gap-3">
              <input
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder={`Type reply to ${selectedConv.profiles?.full_name}...`}
                className="flex-grow bg-secondary border border-theme rounded-xl px-4 py-3 text-sm text-primary outline-none focus:border-purple-500 transition"
              />
              <button
                type="submit"
                disabled={!inputMsg.trim() || sending}
                className="w-12 h-12 rounded-xl bg-purple-500 hover:bg-purple-400 text-white flex items-center justify-center transition disabled:opacity-40 cursor-pointer shrink-0"
              >
                {sending ? (
                  <lucide.Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <lucide.Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <lucide.MessageSquareDashed className="w-16 h-16 text-secondary/40 mb-3" />
            <h3 className="text-sm font-bold text-primary">No Conversation Selected</h3>
            <p className="text-xs text-secondary mt-1">Select a client thread from the queue to start messaging.</p>
          </div>
        )}
      </main>
    </div>
  );
}
