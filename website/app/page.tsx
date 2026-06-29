import type { Metadata } from 'next';
import HeroSection from '@/components/home/HeroSection';
import ServicesSection from '@/components/home/ServicesSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import WhyUsSection from '@/components/home/WhyUsSection';

export const metadata: Metadata = {
  title: 'SiteTrack | Fire Safety & Building Compliance Platform',
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <HowItWorksSection />
      <WhyUsSection />
    </>
  );
}
