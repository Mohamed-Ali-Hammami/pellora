import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CartProvider } from '@/components/cart-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s — ${brand.name}`,
  },
  description: brand.pitch,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.pitch,
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    // Le site ne doit pas être indexe avant d’avoir ses vraies mentions
    // légales et ses vrais visuels : passez NEXT_PUBLIC_ALLOW_INDEXING a
    // « true » le jour du lancement.
    index: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
    follow: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <CartProvider>
          {/* Lien d’évitement : première chose atteinte au clavier. */}
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
          >
            Aller au contenu
          </a>
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
