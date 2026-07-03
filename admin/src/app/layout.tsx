import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ClientToaster } from '@/components/ui/ClientToaster';

export const metadata: Metadata = {
  title: { default: 'SiteTrack Admin', template: '%s | SiteTrack Admin' },
  description: 'SiteTrack Admin Portal — Field Service Management',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
        <div>
          <ClientToaster />
        </div>
      </body>
    </html>
  );
}

