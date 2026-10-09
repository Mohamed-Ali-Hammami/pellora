'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from './cart-provider';
import { brand } from '@/lib/brand';

const NAV = [
  { href: '/produits', label: 'Boutique' },
  { href: '/guides/reussir-son-cafe-filtre', label: 'Guides' },
  { href: '/le-rituel', label: 'Notre démarche' },
  { href: '/suivi', label: 'Suivre ma commande' },
];

export function Header() {
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 leading-none">
          <span className="font-display text-xl font-semibold tracking-tight">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navigation principale">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/panier"
            className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold transition-colors hover:border-ink"
          >
            Panier
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-xs font-bold text-white"
              aria-label={`${itemCount} article${itemCount > 1 ? 's' : ''} dans le panier`}
            >
              {itemCount}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label="Ouvrir le menu"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {open ? '×' : '≡'}
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-mobile" className="border-t border-line bg-paper md:hidden">
          <div className="container-page flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line-soft py-3 text-sm font-medium last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
