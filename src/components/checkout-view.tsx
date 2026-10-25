'use client';

/**
 * Page de commande : récapitulatif, coordonnées du client, RIB.
 *
 * Deux états dans un seul écran plutôt que deux pages :
 *
 *   formulaire ──envoi──> commande enregistrée (référence + RIB)
 *
 * Le second état n'est pas une page distincte, et c'est délibéré. Une
 * redirection vers « /commande/confirmee?ref=… » expose la référence dans
 * l'historique et dans le journal du serveur, impose de relire la commande
 * pour réafficher le RIB, et ne survit de toute façon pas à une fermeture
 * d'onglet. Le client a besoin du RIB ici et maintenant ; l'e-mail est ce qui
 * lui permet d'y revenir.
 *
 * Les montants affichés sont indicatifs : le serveur les recalcule
 * intégralement. Si les deux divergent, c'est le serveur qui a raison, car
 * seul lui n'est pas modifiable depuis le navigateur.
 */

import { useMemo, useState } from 'react';
import { useCart } from './cart-provider';
import { ProductImage } from './product-image';
import { priceShort, interpolate } from '@/lib/format';
import { primaryImage } from '@/lib/product-media';
import { SHIPPING_COUNTRIES, ratesFor, zoneForCountry } from '@/lib/shipping';
import { splitVatInclusive } from '@/lib/money';
import type { Locale } from '@/lib/i18n/config';

export interface BankView {
  holder: string;
  iban: string;
  bic: string;
  bankName: string;
  configured: boolean;
}

interface Props {
  locale: Locale;
  shopHref: string;
  trackingHref: string;
  bank: BankView;
  countryNames: Record<string, string>;
  labels: Record<string, string>;
}

interface Champs {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  transferHolder: string;
}

const VIDE: Champs = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  transferHolder: '',
};

export function CheckoutView({
  locale,
  shopHref,
  trackingHref,
  bank,
  countryNames,
  labels,
}: Props) {
  const { resolved, subtotal, profile, loading, clear } = useCart();
  const [country, setCountry] = useState('FR');
  const [rateId, setRateId] = useState<string | null>(null);
  const [champs, setChamps] = useState<Champs>(VIDE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [declareError, setDeclareError] = useState<string | null>(null);

  /**
   * Le client signale son virement.
   *
   * Ne confirme RIEN : c'est l'équipe, relevé sous les yeux, qui confirme. Ce
   * bouton dit seulement « regardez le compte », et c'est ce qui raccourcit le
   * délai entre le virement et sa constatation.
   */
  async function declare() {
    if (!ref || declaring || declared) return;
    setDeclaring(true);
    setDeclareError(null);
    try {
      const response = await fetch('/api/orders/declare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref, email: champs.email, locale }),
      });
      if (!response.ok) {
        setDeclareError(labels['declareError']!);
        return;
      }
      setDeclared(true);
    } catch {
      setDeclareError(labels['declareError']!);
    } finally {
      setDeclaring(false);
    }
  }

  const zone = zoneForCountry(country);
  const rates = useMemo(() => ratesFor(subtotal, zone, profile), [subtotal, zone, profile]);
  const rate = rates.find((r) => r.id === rateId) ?? rates[0];
  const total = subtotal + (rate?.price ?? 0);

  const set = (clé: keyof Champs) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [clé]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || resolved.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          shippingCountry: country,
          ...(rate ? { shippingRateId: rate.id } : {}),
          lines: resolved.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          customer: {
            firstName: champs.firstName,
            lastName: champs.lastName,
            email: champs.email,
            phone: champs.phone,
            line1: champs.line1,
            line2: champs.line2.trim() === '' ? null : champs.line2,
            postalCode: champs.postalCode,
            city: champs.city,
          },
          transferHolder: champs.transferHolder.trim() === '' ? null : champs.transferHolder,
        }),
      });

      const data: unknown = await response.json();
      const lu = (clé: string): string | null => {
        if (typeof data !== 'object' || data === null) return null;
        const v = (data as Record<string, unknown>)[clé];
        return typeof v === 'string' ? v : null;
      };

      if (!response.ok) {
        setError(lu('error') ?? labels['error']!);
        return;
      }

      const référence = lu('ref');
      if (!référence) {
        setError(labels['error']!);
        return;
      }

      // Le panier n'est vidé qu'ici : si l'envoi échoue, le client doit
      // retrouver sa sélection intacte.
      clear();
      setRef(référence);
    } catch {
      setError(labels['error']!);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Commande enregistrée ──
  if (ref) {
    return (
      <div className="container-page max-w-2xl py-12">
        <div className="card p-6 sm:p-8">
          <p className="eyebrow">{labels['placedEyebrow']}</p>
          <h2 className="mt-2 text-2xl">{labels['placedTitle']}</h2>
          <p className="mt-3 leading-relaxed text-ink-soft">{labels['placedLead']}</p>

          <Rib
            bank={bank}
            amount={priceShort(total, locale)}
            reference={ref}
            labels={labels}
            emphasis
          />

          <p className="mt-6 text-sm leading-relaxed text-ink-soft">
            {interpolate(labels['placedEmail']!, { email: champs.email })}
          </p>

          {/* ── Le client signale son virement ── */}
          <div className="mt-7 rounded-xl border border-line bg-paper p-4">
            {declared ? (
              <p role="status" className="text-sm leading-relaxed text-ink">
                {labels['declareDone']}
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={declare}
                  disabled={declaring}
                  className="btn-primary w-full disabled:opacity-60 sm:w-auto"
                >
                  {declaring ? labels['declarePending'] : labels['declareCta']}
                </button>
                <p className="mt-2.5 text-xs leading-relaxed text-muted">{labels['declareHint']}</p>
                {declareError ? (
                  <p role="alert" className="mt-2 text-sm text-ember">
                    {declareError}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`${trackingHref}?ref=${encodeURIComponent(ref)}`} className="btn-ghost">
              {labels['trackCta']}
            </a>
            <button type="button" onClick={() => window.print()} className="btn-ghost">
              {labels['printCta']}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="container-page py-20" aria-hidden="true" />;

  if (resolved.length === 0) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-ink-soft">{labels['empty']}</p>
        <a href={shopHref} className="btn-primary mt-6 inline-flex">
          {labels['emptyCta']}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_24rem]">
      {/* ── Coordonnées ── */}
      <div>
        <h2 className="text-2xl">{labels['detailsTitle']}</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">{labels['detailsLead']}</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label={labels['firstName']!} value={champs.firstName} onChange={set('firstName')} autoComplete="given-name" required />
          <Field id="lastName" label={labels['lastName']!} value={champs.lastName} onChange={set('lastName')} autoComplete="family-name" required />
          <Field id="email" label={labels['email']!} value={champs.email} onChange={set('email')} type="email" autoComplete="email" required />
          <Field id="phone" label={labels['phone']!} hint={labels['phoneHint']} value={champs.phone} onChange={set('phone')} type="tel" autoComplete="tel" required />
        </div>

        <h3 className="mt-10 text-lg">{labels['addressTitle']}</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="line1" label={labels['line1']!} value={champs.line1} onChange={set('line1')} autoComplete="address-line1" required />
          </div>
          <div className="sm:col-span-2">
            <Field id="line2" label={labels['line2']!} value={champs.line2} onChange={set('line2')} autoComplete="address-line2" />
          </div>
          <Field id="postalCode" label={labels['postalCode']!} value={champs.postalCode} onChange={set('postalCode')} autoComplete="postal-code" required />
          <Field id="city" label={labels['city']!} value={champs.city} onChange={set('city')} autoComplete="address-level2" required />

          <div className="sm:col-span-2">
            <label htmlFor="country" className="block text-sm font-semibold text-ink">
              {labels['country']}
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setRateId(null);
              }}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
            >
              {SHIPPING_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {countryNames[code] ?? code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {rates.length > 1 ? (
          <>
            <h3 className="mt-10 text-lg">{labels['shippingTitle']}</h3>
            <div className="mt-4 grid gap-2.5">
              {rates.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${
                    r.id === rate?.id ? 'border-ink bg-cream' : 'border-line hover:border-ink-soft'
                  }`}
                >
                  <input
                    type="radio"
                    name="rate"
                    value={r.id}
                    checked={r.id === rate?.id}
                    onChange={() => setRateId(r.id)}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="font-semibold text-ink">{r.label[locale]}</span>
                    {r.note ? <span className="mt-0.5 block text-ink-soft">{r.note[locale]}</span> : null}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {r.price === 0 ? labels['free'] : priceShort(r.price, locale)}
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}

        <h3 className="mt-10 text-lg">{labels['transferTitle']}</h3>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">{labels['transferLead']}</p>
        <div className="mt-5 max-w-md">
          <Field
            id="transferHolder"
            label={labels['transferHolder']!}
            hint={labels['transferHolderHint']}
            value={champs.transferHolder}
            onChange={set('transferHolder')}
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Récapitulatif ── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <h2 className="text-lg">{labels['summaryTitle']}</h2>

          <ul className="mt-4 divide-y divide-line">
            {resolved.map((item) => (
              <li key={`${item.productId}:${item.variantId ?? ''}`} className="flex gap-3 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-sand">
                  <ProductImage image={primaryImage(item.product)} locale={locale} width={56} height={56} sizes="56px" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-ink">{item.product.name}</p>
                  <p className="text-muted">× {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {priceShort(item.product.price * item.quantity, locale)}
                </p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <Row label={labels['subtotal']!} value={priceShort(subtotal, locale)} />
            <Row
              label={rate?.label[locale] ?? labels['shipping']!}
              value={rate && rate.price === 0 ? labels['free']! : priceShort(rate?.price ?? 0, locale)}
            />
            <div className="flex items-baseline justify-between border-t border-ink pt-3 text-base font-semibold">
              <dt>{labels['total']}</dt>
              <dd className="tabular-nums">{priceShort(total, locale)}</dd>
            </div>
            <p className="text-xs text-muted">
              {labels['vatLine']} {priceShort(total > 0 ? splitVatInclusive(total).vat : 0, locale)}
            </p>
          </dl>

          {bank.configured ? (
            <Rib bank={bank} amount={priceShort(total, locale)} reference={null} labels={labels} />
          ) : (
            <p className="mt-5 rounded-lg border border-warn/30 bg-[#fdf6e7] px-3 py-2.5 text-xs leading-relaxed text-[#6b4205]">
              {labels['bankMissing']}
            </p>
          )}

          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-ember/30 bg-[#fdf1ec] px-3 py-2.5 text-sm text-ember">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !bank.configured}
            className="btn-ember mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? labels['submitPending'] : labels['submit']}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-muted">{labels['submitNote']}</p>
        </div>
      </aside>
    </form>
  );
}

/**
 * Encadré des coordonnées bancaires.
 *
 * Le montant et la référence sont donnés À CÔTÉ de l'IBAN, et non renvoyés
 * ailleurs sur la page : le client remplit son formulaire de virement dans
 * un autre onglet, et tout ce qu'il doit recopier doit tenir dans un seul
 * regard. L'IBAN est groupé par quatre pour la même raison.
 */
function Rib({
  bank,
  amount,
  reference,
  labels,
  emphasis = false,
}: {
  bank: BankView;
  amount: string;
  reference: string | null;
  labels: Record<string, string>;
  emphasis?: boolean;
}) {
  const iban = bank.iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

  return (
    <div className={`${emphasis ? 'mt-7' : 'mt-5'} rounded-xl border border-line bg-cream p-4`}>
      <p className="eyebrow">{labels['bankTitle']}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Mono label={labels['bankAmount']!} value={amount} strong />
        {reference ? <Mono label={labels['bankReference']!} value={reference} strong /> : null}
        <Mono label={labels['bankHolder']!} value={bank.holder} />
        <Mono label={labels['bankIban']!} value={iban} />
        {bank.bic ? <Mono label={labels['bankBic']!} value={bank.bic} /> : null}
        {bank.bankName ? <Mono label={labels['bankName']!} value={bank.bankName} /> : null}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        {reference
          ? interpolate(labels['bankRefNotice']!, { ref: reference })
          : labels['bankRefLater']}
      </p>
    </div>
  );
}

function Mono({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className={`text-right font-mono ${strong ? 'text-sm font-bold text-ink' : 'text-xs text-ink-soft'}`}>
        {value}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  type = 'text',
  ...rest
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  type?: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {rest.required ? null : <span className="ml-1.5 font-normal text-muted">·</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        {...rest}
        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
      />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
