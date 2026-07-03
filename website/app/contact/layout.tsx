import type { Metadata } from 'next';

import { supabase } from '@/lib/supabase';

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 'global').single();
  const name = data?.platform_name || 'SiteTrack';
  
  return {
    title: 'Contact Us',
    description: `Get in touch with ${name} to discuss your fire safety compliance and building maintenance needs.`,
  };
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
