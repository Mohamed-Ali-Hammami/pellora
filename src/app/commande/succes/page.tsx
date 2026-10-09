import Link from 'next/link';
import type { Metadata } from 'next';
import { ClearCart } from './clear-cart';
import { getStore } from '@/lib/store';
import { formatPrice } from '@/lib/money';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Commande confirmée',
  robots: { index: false, follow: false },
};

/** Jamais de cache : la page dépend de l’état d’une commande précise. */
export const dynamic = 'force-dynamic';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  // La commande peut ne pas être encore enregistrée : le webhook Stripe
  // arrive de façon asynchrone, parfois après la redirection du navigateur.
  // La page doit donc rester correcte sans elle.
  const order = sessionId ? await getStore().findByStripeSession(sessionId) : null;

  return (
    <div className="container-page py-20">
      <ClearCart />

      <div className="mx-auto max-w-xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent"
        >
          &#10003;
        </div>

        <h1 className="mt-6 text-3xl">Merci, c’est enregistre.</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Votre paiement est confirme. Vous allez recevoir un e-mail de confirmation dans les
          prochaines minutes, puis un numéro de suivi dès que le colis quittera l’entrepôt.
        </p>

        {order ? (
          <div className="card mt-8 p-6 text-left">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="eyebrow font-sans">Référence</p>
                <p className="mt-0.5 font-mono text-lg font-semibold">{order.ref}</p>
              </div>
              <p className="text-lg font-semibold">{formatPrice(order.total)}</p>
            </div>

            <ul className="mt-4 divide-y divide-line-soft border-t border-line pt-2">
              {order.lines.map((line) => (
                <li key={`${line.productId}-${line.variantId ?? ''}`} className="flex justify-between gap-4 py-2 text-sm">
                  <span>
                    {line.name}
                    <span className="text-muted"> &times; {line.quantity}</span>
                  </span>
                  <span className="shrink-0">{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <Link href={`/suivi?ref=${encodeURIComponent(order.ref)}`} className="btn-secondary mt-5 w-full">
              Suivre ma commande
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Votre référence de commande vous parvient par e-mail. Si rien n’arrive d’ici une heure,
            ecrivez-nous a{' '}
            <a href={`mailto:${brand.email.support}`} className="text-accent underline">
              {brand.email.support}
            </a>
            .
          </p>
        )}

        <div className="mt-10 border-t border-line pt-8">
          <h2 className="font-display text-xl">En attendant le colis</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Notre guide d’infusion donne les dosages et les temps que nous utilisons. Dix minutes de
            lecture qui changent la première tasse.
          </p>
          <Link href="/guides/reussir-son-cafe-filtre" className="btn-secondary mt-5">
            Lire le guide
          </Link>
        </div>
      </div>
    </div>
  );
}
