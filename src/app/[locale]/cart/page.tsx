import type { Metadata } from 'next';
import { CartView } from '@/components/cart-view';
import { PageHeader } from '@/components/section';
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
      title: dict.cart.title,
      description: dict.cart.title,
      alternates: routeAlternates('cart'),
    }),
    // Un panier est propre à un visiteur : il n'a rien à faire dans un index.
    robots: { index: false, follow: true },
  };
}

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  const query = await searchParams;

  return (
    <>
      <PageHeader title={dict.cart.title} />

      <div className="container-page py-12">
        <CartView
          locale={locale}
          shopHref={href('shop', locale)}
          checkoutHref={href('checkout', locale)}
          canceled={query['canceled'] === '1'}
          countryNames={countryNames(locale, SHIPPING_COUNTRIES)}
          labels={{
            empty: dict.cart.empty,
            emptyCta: dict.cart.emptyCta,
            quantity: dict.common.quantity,
            remove: dict.common.remove,
            increase: dict.common.increaseQuantity,
            decrease: dict.common.decreaseQuantity,
            atMax: dict.common.atMaxQuantity,
            country: dict.cart.countryLabel,
            rate: dict.cart.rateLabel,
            subtotal: dict.common.subtotal,
            shipping: dict.common.shipping,
            total: dict.common.total,
            vatLine: dict.cart.vatLine,
            checkout: dict.cart.checkout,
            freeProgress: dict.cart.freeShippingProgress,
            freeReached: dict.cart.freeShippingReached,
            canceled: dict.cart.canceled,
            error: dict.cart.error,
            secured: dict.cart.securedBy,
            freightNotice: dict.cart.freightNotice,
            vatIncluded: dict.common.vatIncluded,
          }}
        />
      </div>
    </>
  );
}
