import type { Metadata } from 'next';
import { SizingCalculator, type SizingCandidate } from '@/components/sizing-calculator';
import { Notice, PageHeader } from '@/components/section';
import { getStoves } from '@/lib/catalog';
import { priceShort } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { intlLocales } from '@/lib/i18n/config';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href, productHref } from '@/lib/i18n/routes';

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

  return pageMetadata({
    locale,
    title: dict.sizing.title,
    description: dict.sizing.lead,
    alternates: routeAlternates('sizing'),
  });
}

export default async function SizingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  // Les candidats sont préparés ici : le composant client reçoit des chaînes
  // déjà localisées et n'a donc besoin ni du dictionnaire ni du catalogue.
  const candidates: SizingCandidate[] = getStoves().map((product) => ({
    id: product.id,
    name: product.name,
    href: productHref(product.slug[locale], locale),
    category: dict.categories[product.category],
    powerMinKw: product.tech?.powerMinKw ?? 0,
    powerMaxKw: product.tech?.powerMaxKw ?? 0,
    price: priceShort(product.price, locale),
  }));

  return (
    <>
      <PageHeader eyebrow={dict.nav.sizing} title={dict.sizing.title} lead={dict.sizing.lead} />

      <div className="container-page py-12">
        <SizingCalculator
          candidates={candidates}
          locale={intlLocales[locale]}
          labels={{
            area: dict.sizing.areaLabel,
            areaUnit: dict.sizing.areaUnit,
            height: dict.sizing.heightLabel,
            heightUnit: dict.sizing.heightUnit,
            insulation: dict.sizing.insulationLabel,
            insulationOptions: {
              poor: dict.sizing.insulationPoor,
              average: dict.sizing.insulationAverage,
              good: dict.sizing.insulationGood,
              excellent: dict.sizing.insulationExcellent,
            },
            climate: dict.sizing.climateLabel,
            climateOptions: {
              mild: dict.sizing.climateMild,
              temperate: dict.sizing.climateTemperate,
              cold: dict.sizing.climateCold,
            },
            resultTitle: dict.sizing.resultTitle,
            resultRange: dict.sizing.resultRange,
            resultExplain: dict.sizing.resultExplain,
            resultModels: dict.sizing.resultModels,
            resultNone: dict.sizing.resultNone,
            volume: dict.sizing.volumeComputed,
          }}
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <Notice title={dict.sizing.methodTitle}>{dict.sizing.methodText}</Notice>
          <Notice title={dict.sizing.disclaimerTitle} tone="warn">
            {dict.sizing.disclaimerText}
          </Notice>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={href('shop', locale)} className="btn-primary">
            {dict.shop.title}
          </a>
          <a href={href('contact', locale)} className="btn-secondary">
            {dict.home.supportCta}
          </a>
        </div>
      </div>
    </>
  );
}
