import type { Metadata } from 'next';
import { Notice, PageHeader } from '@/components/section';
import { brand, hasCompleteLegalIdentity, isLegalPlaceholder } from '@/lib/brand';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    title: dict.legalPage.title,
    description: dict.legalPage.title,
    alternates: routeAlternates('legal'),
  });
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  const identity = [
    { label: dict.legalPage.entity, value: brand.legal.entity },
    { label: dict.legalPage.form, value: brand.legal.form },
    { label: dict.legalPage.capital, value: brand.legal.capital },
    { label: dict.legalPage.registration, value: brand.legal.registration },
    { label: dict.legalPage.vat, value: brand.legal.vatNumber },
    { label: dict.legalPage.address, value: brand.legal.address },
    { label: dict.legalPage.director, value: brand.legal.director },
  ];

  return (
    <>
      <PageHeader title={dict.legalPage.title} />

      <div className="container-page py-12">
        {/* L'absence de ces mentions est sanctionnée (art. 6 III LCEN en France,
            directive 2011/83/UE dans l'UE) : on l'affiche plutôt que de la masquer. */}
        {!hasCompleteLegalIdentity() ? (
          <div className="mb-10 max-w-3xl">
            <Notice tone="warn">{dict.legalPage.toComplete}</Notice>
          </div>
        ) : null}

        <section>
          <h2 className="text-2xl">{dict.legalPage.editorTitle}</h2>
          <dl className="mt-5 max-w-2xl divide-y divide-line border-y border-line">
            {identity.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <dt className="text-muted">{row.label}</dt>
                <dd className={isLegalPlaceholder(row.value) ? 'text-warn' : 'font-medium text-ink'}>
                  {isLegalPlaceholder(row.value) ? dict.legalPage.toComplete : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl">{dict.legalPage.contactTitle}</h2>
          <p className="mt-3 text-sm text-ink-soft">
            <a href={`mailto:${brand.email.support}`} className="underline underline-offset-4">
              {brand.email.support}
            </a>
            {!isLegalPlaceholder(brand.phone) ? ` · ${brand.phone}` : null}
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl">{dict.legalPage.hostTitle}</h2>
          <p className="mt-3 max-w-2xl text-sm text-ink-soft">{brand.legal.host}</p>
        </section>

        <div className="prose-page mt-12">
          <h2>{dict.legalPage.mediationTitle}</h2>
          <p>{dict.legalPage.mediationText}</p>
          <p>
            <strong>
              {isLegalPlaceholder(brand.legal.mediator) ? dict.legalPage.toComplete : brand.legal.mediator}
            </strong>
          </p>

          <h2>{dict.legalPage.ipTitle}</h2>
          <p>{dict.legalPage.ipText}</p>
        </div>
      </div>
    </>
  );
}
