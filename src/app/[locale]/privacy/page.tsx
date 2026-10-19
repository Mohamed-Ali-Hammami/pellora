import type { Metadata } from 'next';
import { PageHeader } from '@/components/section';
import { brand, isLegalPlaceholder } from '@/lib/brand';
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
    title: dict.privacy.title,
    description: dict.privacy.lead,
    alternates: routeAlternates('privacy'),
  });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.privacy.title} lead={dict.privacy.lead} />

      <div className="container-page py-12">
        <section>
          <h2 className="text-2xl">{dict.privacy.controllerTitle}</h2>
          <p className="mt-3 text-ink-soft">
            {isLegalPlaceholder(brand.legal.entity) ? dict.legalPage.toComplete : brand.legal.entity}
            {' — '}
            <a href={`mailto:${brand.email.support}`} className="underline underline-offset-4">
              {brand.email.support}
            </a>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl">{dict.privacy.dataTitle}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-3 pr-4 font-semibold">{dict.privacy.dataHeaders.data}</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">{dict.privacy.dataHeaders.purpose}</th>
                  <th scope="col" className="py-3 pr-4 font-semibold">{dict.privacy.dataHeaders.basis}</th>
                  <th scope="col" className="py-3 font-semibold">{dict.privacy.dataHeaders.retention}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {dict.privacy.dataRows.map((row) => (
                  <tr key={row.data}>
                    <th scope="row" className="py-3 pr-4 text-left font-medium">{row.data}</th>
                    <td className="py-3 pr-4 text-ink-soft">{row.purpose}</td>
                    <td className="py-3 pr-4 text-ink-soft">{row.basis}</td>
                    <td className="py-3 text-ink-soft">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="prose-page mt-12">
          <h2>{dict.privacy.paymentTitle}</h2>
          <p>{dict.privacy.paymentText}</p>

          <h2>{dict.privacy.cookiesTitle}</h2>
          <p>{dict.privacy.cookiesText}</p>

          <h2>{dict.privacy.rightsTitle}</h2>
          <p>{dict.privacy.rightsText}</p>

          <h2>{dict.privacy.transferTitle}</h2>
          <p>{dict.privacy.transferText}</p>
        </div>
      </div>
    </>
  );
}
