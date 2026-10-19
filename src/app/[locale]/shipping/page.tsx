import type { Metadata } from 'next';
import { Notice, PageHeader } from '@/components/section';
import { priceShort } from '@/lib/format';
import { freeShippingThreshold, ratesFor, type ShippingZone } from '@/lib/shipping';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { countryNames as names, assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    title: dict.shippingPage.title,
    description: dict.shippingPage.lead,
    alternates: routeAlternates('shipping'),
  });
}

/** Pays desservis, par zone tarifaire. */
const zoneCountries: Record<ShippingZone, readonly string[]> = {
  FR: ['FR'],
  BENELUX: ['BE', 'LU', 'NL'],
  IBERIA: ['ES', 'PT'],
  EU: ['DE', 'AT', 'IT', 'IE'],
};

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  /**
   * Le tableau est CALCULÉ à partir de `lib/shipping.ts`, il n'est pas
   * recopié à la main. C'est la seule façon d'être sûr que la grille affichée
   * est celle réellement appliquée au paiement — une page de livraison
   * désynchronisée du code est une promesse non tenue.
   */
  const zones = (Object.keys(zoneCountries) as ShippingZone[]).map((zone) => {
    const freightProfile = { freight: true, weightGrams: 150_000 };
    const parcelProfile = { freight: false, weightGrams: 500 };
    const freight = ratesFor(0, zone, freightProfile)[0];
    const parcel = ratesFor(0, zone, parcelProfile)[0];

    return {
      zone,
      countries: zoneCountries[zone].map((code) => names(locale, [code])[code] ?? code).join(', '),
      freightPrice: freight ? priceShort(freight.price, locale) : '—',
      parcelPrice: parcel ? priceShort(parcel.price, locale) : '—',
      freeFrom: priceShort(freeShippingThreshold(zone, freightProfile), locale),
      days: freight ? `${freight.minDays}–${freight.maxDays} ${dict.common.businessDays}` : '—',
    };
  });

  return (
    <>
      <PageHeader title={dict.shippingPage.title} lead={dict.shippingPage.lead} />

      <div className="container-page py-12">
        <h2 className="text-2xl">{dict.shippingPage.zonesTitle}</h2>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-3 pr-4 font-semibold">{dict.shippingPage.zoneHeader}</th>
                <th scope="col" className="py-3 pr-4 font-semibold">{dict.shippingPage.countriesHeader}</th>
                <th scope="col" className="py-3 pr-4 font-semibold">{dict.shippingPage.freightHeader}</th>
                <th scope="col" className="py-3 pr-4 font-semibold">{dict.shippingPage.parcelHeader}</th>
                <th scope="col" className="py-3 pr-4 font-semibold">{dict.shippingPage.freeHeader}</th>
                <th scope="col" className="py-3 font-semibold">{dict.shippingPage.delayHeader}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {zones.map((row) => (
                <tr key={row.zone}>
                  <th scope="row" className="py-3 pr-4 text-left font-medium">{row.zone}</th>
                  <td className="py-3 pr-4 text-ink-soft">{row.countries}</td>
                  <td className="tabular py-3 pr-4">{row.freightPrice}</td>
                  <td className="tabular py-3 pr-4">{row.parcelPrice}</td>
                  <td className="tabular py-3 pr-4">{row.freeFrom}</td>
                  <td className="tabular py-3 text-ink-soft">{row.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted">{dict.common.vatIncludedLong}</p>

        <h2 className="mt-14 text-2xl">{dict.shippingPage.freightTitle}</h2>
        <ol className="mt-6 max-w-2xl space-y-4">
          {dict.shippingPage.freightSteps.map((step, index) => (
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

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Notice title={dict.shippingPage.accessTitle} tone="warn">
            {dict.shippingPage.accessText}
          </Notice>
          <Notice title={dict.shippingPage.indoorTitle}>{dict.shippingPage.indoorText}</Notice>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={href('returns', locale)} className="btn-secondary">{dict.returns.title}</a>
          <a href={href('faq', locale)} className="btn-secondary">{dict.faq.title}</a>
        </div>
      </div>
    </>
  );
}
