import type { Metadata } from 'next';
import { ContactForm } from './contact-form';
import { PageHeader } from '@/components/section';
import { brand, isLegalPlaceholder } from '@/lib/brand';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { href } from '@/lib/i18n/routes';

export function generateStaticParams() {
  return localeStaticParams();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    title: dict.contact.title,
    description: dict.contact.lead,
    alternates: routeAlternates('contact'),
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  const rows = [
    { label: dict.contact.emailLabel, value: brand.email.support, href: `mailto:${brand.email.support}` },
    ...(isLegalPlaceholder(brand.phone)
      ? []
      : [{ label: dict.contact.phoneLabel, value: brand.phone, href: `tel:${brand.phone.replace(/\s/g, '')}` }]),
    { label: dict.contact.hoursLabel, value: dict.contact.hoursValue, href: null },
    { label: dict.contact.responseLabel, value: dict.contact.responseValue, href: null },
  ];

  return (
    <>
      <PageHeader title={dict.contact.title} lead={dict.contact.lead} />

      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
        <div>
          <h2 className="text-2xl">{dict.contact.formTitle}</h2>
          <div className="mt-6 max-w-xl">
            <ContactForm
              to={brand.email.support}
              labels={{
                name: dict.contact.nameLabel,
                email: dict.common.email,
                message: dict.contact.messageLabel,
                messagePlaceholder: dict.contact.messagePlaceholder,
                submit: dict.contact.submit,
                hint: dict.contact.mailtoHint,
                required: dict.common.required,
              }}
            />
          </div>
        </div>

        <aside>
          <dl className="card divide-y divide-line">
            {rows.map((row) => (
              <div key={row.label} className="px-5 py-4">
                <dt className="text-xs text-muted">{row.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-ink">
                  {row.href ? (
                    <a href={row.href} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-6 space-y-2 text-sm">
            <li><a href={href('faq', locale)} className="text-ink-soft hover:text-ember">{dict.faq.title}</a></li>
            <li><a href={href('sizing', locale)} className="text-ink-soft hover:text-ember">{dict.sizing.title}</a></li>
            <li><a href={href('tracking', locale)} className="text-ink-soft hover:text-ember">{dict.tracking.title}</a></li>
          </ul>
        </aside>
      </div>
    </>
  );
}
