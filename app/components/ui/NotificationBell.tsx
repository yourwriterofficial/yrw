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
  id: number;
  subject: string;
  status: string;
  sent_at: string;
  order_id: string | null;
}

export default function NotificationBell({ isAdmin, userEmail }: { isAdmin: boolean; userEmail: string }) {
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

    // Set up realtime channel
    const channel = supabase
      .channel('email-log-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_logs' },
        () => {
          fetchNotifications();
          // Visual feedback
          showToast('🔔 New in-app alert received', 'info');
        }
      )
      .subscribe();

    // Close on click outside
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', clickOutside);
    };
  }, [fetchNotifications]);

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

    // 2. Route to exact item/order
    if (notif.order_id) {
      if (isAdmin) {
        router.push(`/admin/orders?open=${notif.order_id}`);
      } else {
        router.push(`/dashboard/client?preview=${notif.order_id}`);
      }
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
      const diffHours = Math.floor(diffMins / 600);
      
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
        <div className="absolute right-0 mt-3 w-80 bg-primary border border-theme rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
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
          <div className="max-h-[300px] overflow-y-auto divide-y divide-theme">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-secondary text-xs">
                <lucide.BellOff className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full p-4 text-left hover:bg-white/5 transition flex items-start gap-3 text-xs ${
                    n.status !== 'read' ? 'bg-purple-500/5' : ''
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    n.status !== 'read' ? 'bg-purple-500' : 'bg-transparent'
                  }`} />
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className={`text-primary leading-snug ${n.status !== 'read' ? 'font-bold' : 'font-medium'}`}>
                      {n.subject}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-secondary font-bold pt-1">
                      <span>{n.order_id ? `#${n.order_id}` : 'System'}</span>
                      <span>{formatDate(n.sent_at)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
