import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jaqkqlitaqxjbkxfcvjs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphcWtxbGl0YXF4amJreGZjdmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY3MjAsImV4cCI6MjA5NjUyMjcyMH0.Ylj6HhK0H9JMeqeOFFd_wkbMl1O7BHlQpI1ZloXampI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);