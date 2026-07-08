"use client";

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqieirvzutdculcdsncb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pjEo4HVVSPTMF-fQDwKpLQ_o9HAIOWR';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);