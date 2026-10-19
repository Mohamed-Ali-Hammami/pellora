import type { Metadata } from 'next';
import { Notice, PageHeader } from '@/components/section';
import { hasCompleteLegalIdentity } from '@/lib/brand';
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
    title: dict.terms.title,
    description: dict.terms.lead,
    alternates: routeAlternates('terms'),
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.terms.title} lead={dict.terms.lead} />

      <div className="container-page py-12">
        {/* Le modèle n'est pas un document validé : tant que l'identité de
            l'exploitant n'est pas renseignée, on le dit en haut de page. */}
        {!hasCompleteLegalIdentity() ? (
          <div className="mb-10 max-w-3xl">
            <Notice tone="warn">{dict.terms.toComplete}</Notice>
          </div>
        ) : null}

        <div className="prose-page">
          {dict.terms.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
