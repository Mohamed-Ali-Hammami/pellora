import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale } from '@/lib/i18n/config';
import { href } from '@/lib/i18n/routes';

/**
 * Page 404 du segment de langue.
 *
 * Elle ne peut pas lire `params` — Next rend `not-found` hors du contexte de
 * route — donc elle s'affiche dans la langue par défaut, avec le sélecteur de
 * l'en-tête pour changer. Le maillage reste utilisable : c'est ce qui compte
 * sur une page d'erreur.
 */
export default function NotFound() {
  const dict = getDictionary(defaultLocale);

  return (
    <div className="container-page flex min-h-[55vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl md:text-4xl">{dict.notFound.title}</h1>
      <p className="mt-4 max-w-xl text-ink-soft">{dict.notFound.lead}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={href('home', defaultLocale)} className="btn-primary">
          {dict.notFound.cta}
        </a>
        <a href={href('shop', defaultLocale)} className="btn-secondary">
          {dict.notFound.shopCta}
        </a>
      </div>
    </div>
  );
}
