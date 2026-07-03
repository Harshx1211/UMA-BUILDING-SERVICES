import { cache } from 'react';
import { supabase } from './supabase';

export const getGlobalSettings = cache(async () => {
  const { data } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 'global')
    .single();
  return data;
});
