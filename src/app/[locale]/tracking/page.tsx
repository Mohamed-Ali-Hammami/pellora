import type { Metadata } from 'next';
import { TrackingForm } from './tracking-form';
import { PageHeader } from '@/components/section';
import { intlLocales } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  return {
    ...pageMetadata({
      locale,
      title: dict.tracking.title,
      description: dict.tracking.lead,
      alternates: routeAlternates('tracking'),
    }),
    robots: { index: false, follow: true },
  };
}

export default async function TrackingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  return (
    <>
      <PageHeader title={dict.tracking.title} lead={dict.tracking.lead} />

      <div className="container-page py-12">
        <div className="max-w-2xl">
          <TrackingForm
            locale={locale}
            intlLocale={intlLocales[locale]}
            labels={{
              ref: dict.tracking.refLabel,
              refPlaceholder: dict.tracking.refPlaceholder,
              email: dict.common.email,
              submit: dict.tracking.submit,
              loading: dict.common.loading,
              notFound: dict.tracking.notFound,
              status: dict.tracking.statusLabel,
              placedOn: dict.tracking.placedOn,
              items: dict.tracking.itemsLabel,
              carrier: dict.tracking.carrierLabel,
              trackingNumber: dict.tracking.trackingNumber,
              total: dict.common.total,
              shipping: dict.common.shipping,
              statuses: dict.tracking.statuses,
            }}
          />
        </div>

        <p className="mt-10 text-sm text-muted">
          <a href={href('contact', locale)} className="underline underline-offset-4 hover:text-ink">
            {dict.contact.title}
          </a>
        </p>
      </div>
    </>
  );
}
