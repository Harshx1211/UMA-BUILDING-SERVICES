import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: {
    default: 'SiteTrack | Fire Safety & Building Compliance Platform',
    template: '%s | SiteTrack',
  },
  description:
    'SiteTrack is the ultimate SaaS platform for Fire Safety and Building Compliance companies. Power your technicians with a mobile app, offline sync, and automated reporting.',
  keywords: [
    'fire safety inspection',
    'building compliance',
    'routine maintenance',
    'defect repair',
    'fire extinguisher inspection',
    'emergency lighting',
    'building services software',
    'SiteTrack SaaS',
  ],
  openGraph: {
    title: 'SiteTrack | Fire Safety & Building Compliance Platform',
    description:
      'The ultimate software platform for modern fire safety companies. Automate compliance, dispatch technicians, and generate PDF reports instantly.',
    type: 'website',
    locale: 'en_AU',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="bg-[#060f1e] text-[#F8FAFC]">
        <Navbar />
        <main className="animate-page-enter">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
