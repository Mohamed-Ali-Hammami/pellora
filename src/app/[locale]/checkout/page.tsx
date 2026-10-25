import type { Metadata } from 'next';
import { CheckoutView } from '@/components/checkout-view';
import { PageHeader } from '@/components/section';
import { bankDetails, isBankConfigured } from '@/lib/bank';
import { SHIPPING_COUNTRIES } from '@/lib/shipping';
import { getDictionary } from '@/lib/i18n/dictionaries';
import {
  assertLocale,
  countryNames,
  localeStaticParams,
  pageMetadata,
  routeAlternates,
} from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

/**
 * Page de commande.
 *
 * Composant serveur : c'est lui qui lit les coordonnées bancaires, parce que
 * `lib/bank` refuse d'être chargé côté client. Elles descendent en props vers
 * l'îlot client. Un `NEXT_PUBLIC_IBAN` aurait été plus court, mais figerait
 * le RIB dans chaque page construite — il faut pouvoir changer de compte sans
 * reconstruire le site.
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
      title: dict.checkout.title,
      description: dict.checkout.lead,
      alternates: routeAlternates('checkout'),
    }),
    // Une commande en cours est propre à un visiteur : hors index.
    robots: { index: false, follow: true },
  };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  const bank = bankDetails();

  return (
    <>
      <PageHeader title={dict.checkout.title} lead={dict.checkout.lead} />

      <CheckoutView
        locale={locale}
        shopHref={href('shop', locale)}
        trackingHref={href('tracking', locale)}
        bank={{ ...bank, configured: isBankConfigured() }}
        countryNames={countryNames(locale, SHIPPING_COUNTRIES)}
        labels={{
          empty: dict.cart.empty,
          emptyCta: dict.cart.emptyCta,
          free: dict.emails.free,
          subtotal: dict.common.subtotal,
          shipping: dict.common.shipping,
          total: dict.common.total,
          vatLine: dict.cart.vatLine,
          error: dict.checkout.error,

          detailsTitle: dict.checkout.detailsTitle,
          detailsLead: dict.checkout.detailsLead,
          firstName: dict.checkout.firstName,
          lastName: dict.checkout.lastName,
          email: dict.checkout.email,
          phone: dict.checkout.phone,
          phoneHint: dict.checkout.phoneHint,
          addressTitle: dict.checkout.addressTitle,
          line1: dict.checkout.line1,
          line2: dict.checkout.line2,
          postalCode: dict.checkout.postalCode,
          city: dict.checkout.city,
          country: dict.cart.countryLabel,
          shippingTitle: dict.checkout.shippingTitle,

          transferTitle: dict.checkout.transferTitle,
          transferLead: dict.checkout.transferLead,
          transferHolder: dict.checkout.transferHolder,
          transferHolderHint: dict.checkout.transferHolderHint,

          summaryTitle: dict.checkout.summaryTitle,
          submit: dict.checkout.submit,
          submitPending: dict.checkout.submitPending,
          submitNote: dict.checkout.submitNote,

          bankTitle: dict.emails.transferHow,
          bankAmount: dict.emails.bankAmount,
          bankReference: dict.emails.bankReference,
          bankHolder: dict.emails.bankHolder,
          bankIban: dict.emails.bankIban,
          bankBic: dict.emails.bankBic,
          bankName: dict.emails.bankName,
          bankRefNotice: dict.emails.transferRefNotice,
          bankRefLater: dict.checkout.bankRefLater,
          bankMissing: dict.checkout.bankMissing,

          declareCta: dict.checkout.declareCta,
          declarePending: dict.checkout.declarePending,
          declareDone: dict.checkout.declareDone,
          declareHint: dict.checkout.declareHint,
          declareError: dict.checkout.declareError,
          placedEyebrow: dict.checkout.placedEyebrow,
          placedTitle: dict.checkout.placedTitle,
          placedLead: dict.checkout.placedLead,
          placedEmail: dict.checkout.placedEmail,
          trackCta: dict.emails.trackCta,
          printCta: dict.checkout.printCta,
        }}
      />
    </>
  );
}
