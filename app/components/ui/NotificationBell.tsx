'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import * as lucide from 'lucide-react';
import { showToast } from './Toast';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Notification {
  id: string;
  subject: string;
  message?: string | null;
  type?: string | null;
  status: string;
  sent_at: string;
  order_id: string | null;
  link?: string | null;
}

const TYPE_ICON: Record<string, keyof typeof lucide> = {
  order_update: 'Package',
  payment: 'Wallet',
  vault_delivery: 'FolderCheck',
  admin_message: 'MessageCircle',
  promotion: 'Megaphone',
  system: 'Info',
};

const TYPE_COLOR: Record<string, string> = {
  order_update: 'bg-blue-500/10 text-blue-400',
  payment: 'bg-emerald-500/10 text-emerald-400',
  vault_delivery: 'bg-purple-500/10 text-purple-400',
  admin_message: 'bg-amber-500/10 text-amber-400',
  promotion: 'bg-pink-500/10 text-pink-400',
  system: 'bg-slate-500/10 text-slate-400',
};

export default function NotificationBell({ isAdmin, userEmail, userId }: { isAdmin: boolean; userEmail: string; userId?: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Close on click outside
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);

    if (!userId) {
      return () => document.removeEventListener('mousedown', clickOutside);
    }

    // Set up realtime channel, scoped to this user's own notifications only
    const channel = supabase
      .channel(`notification-alerts-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          fetchNotifications();
          // Visual feedback
          showToast('🔔 New in-app alert received', 'info');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', clickOutside);
    };
  }, [fetchNotifications, userId]);

  const handleNotificationClick = async (notif: Notification) => {
    setIsOpen(false);
    
    // 1. Mark as read on backend
    if (notif.status !== 'read') {
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id }),
        });
        // Update local state
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, status: 'read' } : n))
        );
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    }

    // 2. Route to the linked page, fall back to the order, then to the dashboard home —
    // every notification must go somewhere, even generic broadcast messages that have
    // neither a link nor an order_id (e.g. admin mass-notify, individual admin DMs).
    if (notif.link) {
      router.push(notif.link);
    } else if (notif.order_id) {
      if (isAdmin) {
        router.push(`/admin/orders?open=${notif.order_id}`);
      } else {
        router.push(`/dashboard/client?preview=${notif.order_id}`);
      }
    } else {
      router.push(isAdmin ? '/admin' : '/dashboard/client');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        showToast('All notifications marked as read', 'success');
      }
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const unreadCount = notifications.filter(n => n.status !== 'read').length;

  const formatDate = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-secondary hover:bg-white/5 border border-theme rounded-xl text-primary transition flex items-center justify-center cursor-pointer"
        aria-label="View notifications"
      >
        <lucide.Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-[swing_2s_infinite_ease-in-out]' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse border border-primary">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-primary border border-theme rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="p-4 bg-secondary border-b border-theme flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-primary">In-App Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-black rounded">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] font-black uppercase text-purple-400 hover:text-purple-300 transition cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-theme">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-secondary text-xs">
                <lucide.BellOff className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const unread = n.status !== 'read';
                const IconComp = lucide[TYPE_ICON[n.type || 'system'] || 'Info'] as lucide.LucideIcon;
                const typeColor = TYPE_COLOR[n.type || 'system'] || TYPE_COLOR.system;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`relative w-full p-4 text-left hover:bg-white/5 transition flex items-start gap-3 text-xs ${
                      unread ? 'bg-purple-500/5' : ''
                    }`}
                  >
                    {unread && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500" />}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${typeColor}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-primary leading-snug ${unread ? 'font-bold' : 'font-medium'}`}>
                          {n.subject}
                        </p>
                        {unread && <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />}
                      </div>
                      {n.message && (
                        <p className="text-secondary leading-snug line-clamp-2 font-medium">
                          {n.message}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-[10px] text-secondary font-bold pt-1">
                        <span>{n.order_id ? `#${n.order_id}` : 'System'}</span>
                        <span>{formatDate(n.sent_at)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
