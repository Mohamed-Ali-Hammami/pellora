import Link from 'next/link';
import { brand } from '@/lib/brand';

const COLUMNS = [
  {
    title: 'Boutique',
    links: [
      { href: '/produits', label: 'Tous les produits' },
      { href: '/produits/kit-rituel-complet', label: 'Kit Rituel Complet' },
      { href: '/produits/moulin-manuel-precision', label: 'Moulin Précision' },
      { href: '/guides/reussir-son-cafe-filtre', label: 'Guides d’infusion' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { href: '/suivi', label: 'Suivre ma commande' },
      { href: '/retours', label: 'Retours et remboursements' },
      { href: '/livraison', label: 'Livraison' },
      { href: `mailto:${brand.email.support}`, label: 'Nous écrire' },
    ],
  },
  {
    title: 'Informations',
    links: [
      { href: '/le-rituel', label: 'Notre démarche' },
      { href: '/cgv', label: 'Conditions générâles de vente' },
      { href: '/mentions-legales', label: 'Mentions légales' },
      { href: '/confidentialite', label: 'Données personnelles' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-cream">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="font-display text-lg font-semibold">{brand.name}</div>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{brand.pitch}</p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="eyebrow font-sans">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-soft transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {brand.legalName}. Tous droits réservés.
          </p>
          <p>Paiement sécurisé par Stripe — CB, Apple Pay, Google Pay.</p>
        </div>
      </div>
    </footer>
  );
}
