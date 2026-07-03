import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getGlobalSettings } from '@/lib/settings';

// TODO: replace with your real production domain before launch.
// Required for OG/Twitter images to resolve correctly when using relative paths.
const SITE_URL = 'https://sitetrack.app';

export async function generateMetadata(): Promise<Metadata> {
  const data = await getGlobalSettings();
  const name = data?.platform_name || 'SiteTrack';

  const title = `${name} | Fire Safety & Building Compliance Platform`;
  const description = `${name} is the ultimate SaaS platform for Fire Safety and Building Compliance companies. Power your technicians with a mobile app, offline sync, and automated reporting.`;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${name}`,
    },
    description,
    keywords: [
      'fire safety inspection',
      'building compliance',
      'routine maintenance',
      'defect repair',
      'fire extinguisher inspection',
      'emergency lighting',
      'building services software',
      `${name} SaaS`,
    ],
    openGraph: {
      title,
      description:
        'The ultimate software platform for modern fire safety companies. Automate compliance, dispatch technicians, and generate PDF reports instantly.',
      type: 'website',
      locale: 'en_AU',
      url: SITE_URL,
      siteName: name,
      // TODO: swap for a real 1200x630 image at /public/og-image.jpg
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: `${name} — Fire Safety & Building Compliance Platform`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description:
        'The ultimate software platform for modern fire safety companies. Automate compliance, dispatch technicians, and generate PDF reports instantly.',
      images: ['/og-image.jpg'],
    },
    themeColor: '#0F1E3C', // matches --navy — controls mobile browser chrome color
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getGlobalSettings();
  const platformName = settings?.platform_name || 'SiteTrack';
  const supportEmail = settings?.support_email || 'hello@sitetrack.app';

  return (
    <html lang="en-AU" suppressHydrationWarning data-scroll-behavior="smooth">
      {/* No hardcoded bg/text classes here — globals.css already sets these
          on `body` via --off-white / --text. Keeping them here too would be
          a second source of truth for the same colors. */}
      <body>
        <Navbar platformName={platformName} />
        {children}
        <Footer platformName={platformName} supportEmail={supportEmail} />
      </body>
    </html>
  );
}
