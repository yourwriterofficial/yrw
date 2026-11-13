'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function HomeStats({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [topicCount, setTopicCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cached = sessionStorage.getItem('yrw_topic_count');
        if (cached !== null) {
          const parsed = Number(cached);
          if (Number.isFinite(parsed)) {
            await Promise.resolve();
            if (active) setTopicCount(parsed);
            return;
          }
        }
      } catch {
        // sessionStorage unavailable
      }

      const { count } = await supabase
        .from('project_topics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (active && count !== null && count !== undefined) {
        setTopicCount(count);
        try {
          sessionStorage.setItem('yrw_topic_count', String(count));
        } catch {
          // ignore
        }
      }
    })();
    return () => { active = false; };
  }, []);

  if (topicCount === null) return null;

  const rounded = Math.floor(topicCount / 100) * 100;

  return (
    <span className={className}>
      {compact ? `${rounded.toLocaleString()}+` : `${rounded.toLocaleString()}+ ready-made topics in stock`}
    </span>
  );
}
