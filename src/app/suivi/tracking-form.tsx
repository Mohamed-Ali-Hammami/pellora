'use client';

/**
 * Suivi en libre-service.
 *
 * C’est ce qui absorbe l’essentiel du support en dropshipping : sans cette
 * page, chaque commande génère un a deux e-mails « où est mon colis ? ».
 * La référence ET l’e-mail sont exiges, sinon n’importe qui pourrait consulter
 * une commande en devinant une référence.
 */

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { formatPrice } from '@/lib/money';
import type { PublicOrder } from '@/lib/order-view';

const STATUS_LABELS: Record<string, { label: string; detail: string; tone: string }> = {
  pending: {
    label: 'En attente de paiement',
    detail: 'Le paiement n’est pas encore confirmé.',
    tone: 'text-warn',
  },
  paid: {
    label: 'Paiement confirme',
    detail: 'Votre commande part en préparation.',
    tone: 'text-success',
  },
  forwarded: {
    label: 'En préparation',
    detail: 'L’entrepôt prépare votre colis. Le numéro de suivi arrive sous 1 a 2 jours ouvrés.',
    tone: 'text-success',
  },
  shipped: {
    label: 'Expédiée',
    detail: 'Le colis est entre les mains du transporteur.',
    tone: 'text-success',
  },
  delivered: { label: 'Livrée', detail: 'Le colis a été remis.', tone: 'text-success' },
  fulfillment_failed: {
    label: 'Traitement en cours',
    detail: 'Un incident technique retarde la préparation. Nous sommes dessus — aucune action de votre part.',
    tone: 'text-warn',
  },
  refunded: { label: 'Remboursée', detail: 'Le remboursement a été émis.', tone: 'text-muted' },
  cancelled: { label: 'Annulée', detail: 'Cette commande a été annulée.', tone: 'text-muted' },
};

export function TrackingForm() {
  const params = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') ?? '');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const query = new URLSearchParams({ ref, email });
      const response = await fetch(`/api/orders/lookup?${query}`);
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : 'Recherche impossible.',
        );
        return;
      }
      if (data && typeof data === 'object' && 'order' in data) {
        setOrder((data as { order: PublicOrder }).order);
      }
    } catch {
      setError('Connexion impossible. Réessayez dans un instant.');
    } finally {
      setLoading(false);
    }
  }

  const status = order ? STATUS_LABELS[order.status] : null;

  return (
    <>
      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        <div>
          <label htmlFor="ref" className="block text-sm font-semibold">
            Référence de commande
          </label>
          <input
            id="ref"
            required
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            placeholder="VRS-XXXXXX"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-sm uppercase"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            autoComplete="email"
            className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Recherche…' : 'Afficher ma commande'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-5 rounded-card border border-line bg-cream p-4 text-sm">
          {error}
        </p>
      )}

      {order && status && (
        <div className="card mt-6 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-sm text-muted">{order.ref}</p>
            <p className="font-semibold">{formatPrice(order.total)}</p>
          </div>

          <p className={`mt-3 font-display text-xl ${status.tone}`}>{status.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{status.detail}</p>

          {order.trackingNumber && (
            <div className="mt-5 rounded-lg border border-line bg-cream p-4">
              <p className="eyebrow font-sans">Numéro de suivi</p>
              <p className="mt-1 font-mono text-base font-semibold">{order.trackingNumber}</p>
              {order.carrier && <p className="mt-0.5 text-sm text-muted">{order.carrier}</p>}
            </div>
          )}

          <ul className="mt-5 divide-y divide-line-soft border-t border-line pt-2">
            {order.lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex justify-between gap-4 py-2 text-sm">
                <span>{line.name}</span>
                <span className="shrink-0 text-muted">&times; {line.quantity}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-muted">
            Commande passée le{' '}
            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {order.city ? ` — livraison a ${order.city}` : ''}.
          </p>
        </div>
      )}
    </>
  );
}
