import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Rasoi Rang · रसोई रंग',
  description: 'Order Rajasthani food from your table or for takeaway and watch it travel from kitchen to plate, live.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#a52a1b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600;700;800&family=Yatra+One&display=swap" rel="stylesheet" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
