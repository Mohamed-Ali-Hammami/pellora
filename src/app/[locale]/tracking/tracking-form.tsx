'use client';

/**
 * Suivi de commande en libre-service.
 *
 * L'API exige la référence ET l'adresse e-mail : une référence seule circule
 * dans des e-mails transférés et ne peut donc pas autoriser l'accès.
 *
 * Les messages d'erreur affichés sont ceux du dictionnaire, jamais ceux
 * renvoyés par l'API : le serveur répond volontairement la même chose quand
 * la commande n'existe pas et quand l'e-mail ne correspond pas, pour ne pas
 * permettre d'énumérer les références valides.
 */

import { useState } from 'react';
import { priceShort, dateShort } from '@/lib/format';
import type { PublicOrder } from '@/lib/order-view';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  locale: Locale;
  intlLocale: string;
  labels: {
    ref: string;
    refPlaceholder: string;
    email: string;
    submit: string;
    loading: string;
    notFound: string;
    status: string;
    placedOn: string;
    items: string;
    carrier: string;
    trackingNumber: string;
    total: string;
    shipping: string;
    statuses: Record<string, string>;
  };
}

export function TrackingForm({ locale, labels }: Props) {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'missing'>('idle');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('loading');
    setOrder(null);

    try {
      const query = new URLSearchParams({ ref: reference.trim(), email: email.trim() });
      const response = await fetch(`/api/orders/lookup?${query.toString()}`);
      const payload: unknown = await response.json();

      const found =
        response.ok && typeof payload === 'object' && payload !== null && 'order' in payload
          ? (payload as { order: PublicOrder }).order
          : null;

      if (!found) {
        setState('missing');
        return;
      }
      setOrder(found);
      setState('idle');
    } catch {
      setState('missing');
    }
  }

  return (
    <>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label htmlFor="track-ref" className="mb-1.5 block text-sm font-semibold text-ink">
            {labels.ref}
          </label>
          <input
            id="track-ref"
            required
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder={labels.refPlaceholder}
            className="tabular w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm uppercase placeholder:normal-case placeholder:text-muted"
          />
        </div>

        <div>
          <label htmlFor="track-email" className="mb-1.5 block text-sm font-semibold text-ink">
            {labels.email}
          </label>
          <input
            id="track-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
          />
        </div>

        <button type="submit" disabled={state === 'loading'} className="btn-primary w-full sm:w-auto">
          {state === 'loading' ? labels.loading : labels.submit}
        </button>
      </form>

      {state === 'missing' ? (
        <p role="alert" className="mt-5 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-ink-soft">
          {labels.notFound}
        </p>
      ) : null}

      {order ? (
        <div className="card mt-6 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="tabular font-display text-2xl font-semibold">{order.ref}</p>
            <span className="chip-ember">{labels.statuses[order.status] ?? order.status}</span>
          </div>

          <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
            <Row label={labels.placedOn} value={dateShort(order.createdAt, locale)} />
            <Row label={labels.shipping} value={order.shippingLabel} />
            <Row label={labels.total} value={priceShort(order.total, locale)} />
            {order.carrier ? <Row label={labels.carrier} value={order.carrier} /> : null}
            {order.trackingNumber ? (
              <Row label={labels.trackingNumber} value={order.trackingNumber} />
            ) : null}
          </dl>

          <p className="eyebrow mt-6">{labels.items}</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {order.lines.map((line) => (
              <li key={`${line.name}-${line.quantity}`}>
                {line.quantity} × {line.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular font-medium text-ink">{value}</dd>
    </div>
  );
}
