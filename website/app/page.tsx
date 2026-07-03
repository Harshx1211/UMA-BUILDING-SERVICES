import type { Metadata } from 'next';
import HeroSection from '@/components/home/HeroSection';
import ServicesSection from '@/components/home/ServicesSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import WhyUsSection from '@/components/home/WhyUsSection';

import { getGlobalSettings } from '@/lib/settings';

export default async function HomePage() {
  const data = await getGlobalSettings();
  const platformName = data?.platform_name || 'SiteTrack';

  return (
    <>
      <HeroSection platformName={platformName} />
      <ServicesSection platformName={platformName} />
      <HowItWorksSection platformName={platformName} />
      <WhyUsSection platformName={platformName} />
    </>
  );
}
