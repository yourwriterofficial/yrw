'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function HomeStats({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [topicCount, setTopicCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from('project_topics')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      setTopicCount(count ?? null);
    })();
  }, []);

  if (topicCount === null) return null;

  const rounded = Math.floor(topicCount / 100) * 100;

  return (
    <span className={className}>
      {compact ? `${rounded.toLocaleString()}+` : `${rounded.toLocaleString()}+ ready-made topics in stock`}
    </span>
  );
}
