'use client';
import dynamic from 'next/dynamic';

const Toaster = dynamic(() => import('react-hot-toast').then((mod) => mod.Toaster), {
  ssr: false,
});

export function ClientToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        },
        success: { iconTheme: { primary: '#22c55e', secondary: 'var(--card)' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: 'var(--card)' } },
      }}
    />
  );
}
