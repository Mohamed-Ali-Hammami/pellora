import type { Metadata } from 'next';
import { ClearCart } from './clear-cart';
import { Notice, PageHeader } from '@/components/section';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

/**
 * Confirmation de commande.
 *
 * La page ne lit volontairement pas la session Stripe pour afficher un
 * montant : l'état qui fait foi est celui écrit par le webhook, pas un
 * paramètre d'URL que le visiteur peut modifier. On affiche la référence
 * passée en paramètre, et le détail reste accessible par le suivi de commande
 * qui, lui, vérifie l'adresse e-mail.
 */

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return {
    ...pageMetadata({
      locale,
      title: dict.checkout.successTitle,
      description: dict.checkout.successLead,
      alternates: routeAlternates('checkoutSuccess'),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  const query = await searchParams;

  const reference = typeof query['ref'] === 'string' ? query['ref'] : null;
  const hasSession = typeof query['session_id'] === 'string';

  return (
    <>
      {/* Le panier n'est vidé qu'ici : si le visiteur abandonne le paiement, il
          doit retrouver son panier intact. */}
      <ClearCart />

      <PageHeader title={dict.checkout.successTitle} lead={dict.checkout.successLead} />

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_22rem]">
        <div>
          {reference ? (
            <div className="card mb-8 p-5">
              <p className="eyebrow">{dict.checkout.reference}</p>
              <p className="tabular mt-1 font-display text-2xl font-semibold">{reference}</p>
            </div>
          ) : !hasSession ? (
            <p className="mb-8 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-ink-soft">
              {dict.checkout.noSession}
            </p>
          ) : null}

          <h2 className="text-2xl">{dict.checkout.nextStepsTitle}</h2>
          <ol className="mt-5 space-y-4">
            {dict.checkout.nextSteps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
                >
                  {index + 1}
                </span>
                <span className="text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Notice title={dict.checkout.damageTitle} tone="warn">
              {dict.checkout.damageText}
            </Notice>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-6">
            <a href={href('tracking', locale)} className="btn-primary w-full">
              {dict.checkout.trackCta}
            </a>
            <a href={href('shop', locale)} className="btn-secondary mt-3 w-full">
              {dict.common.continueShopping}
            </a>
            <ul className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
              <li>
                <a href={href('shipping', locale)} className="text-ink-soft hover:text-ember">
                  {dict.shippingPage.title}
                </a>
              </li>
              <li>
                <a href={href('returns', locale)} className="text-ink-soft hover:text-ember">
                  {dict.returns.title}
                </a>
              </li>
              <li>
                <a href={href('contact', locale)} className="text-ink-soft hover:text-ember">
                  {dict.contact.title}
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
