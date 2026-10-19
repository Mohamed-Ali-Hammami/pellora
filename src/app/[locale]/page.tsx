import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { ProductImage } from '@/components/product-image';
import { SectionHeading } from '@/components/section';
import { brand, promises } from '@/lib/brand';
import { getHeroProducts, getProductsByCategory } from '@/lib/catalog';
import { guides } from '@/lib/guides';
import { primaryImage } from '@/lib/product-media';
import { priceShort, date as formatDate } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { assertLocale, localeStaticParams, pageMetadata, routeAlternates } from '@/lib/i18n/page';
import { guideHref, href } from '@/lib/i18n/routes';
import type { Locale } from '@/lib/i18n/config';

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
    title: `${brand.name} — ${dict.meta.homeTitle}`,
    description: dict.meta.homeDescription,
    alternates: routeAlternates('home'),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = assertLocale((await params).locale);
  const dict = getDictionary(locale);

  const featured = getHeroProducts().slice(0, 4);
  const airStoves = getProductsByCategory('air');
  const hydroStoves = getProductsByCategory('hydro');

  /**
   * Données structurées de l'enseigne. Elles doivent rester exactes : une
   * donnée structurée fausse expose à une pénalité de référencement, et c'est
   * aussi une pratique commerciale trompeuse.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: brand.name,
    description: dict.meta.homeDescription,
    url: `${brand.url}${href('home', locale)}`,
    email: brand.email.support,
    areaServed: ['FR', 'BE', 'LU', 'NL', 'DE', 'AT', 'IT', 'ES', 'PT', 'IE'],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Hero locale={locale} dict={dict} />
      <TrustBar locale={locale} />
      <Families locale={locale} dict={dict} airCount={airStoves.length} hydroCount={hydroStoves.length} />

      {/* ───────────────────────────── Modèles mis en avant ───────────────────────────── */}
      <section className="container-page py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title={dict.home.featuredTitle} lead={dict.home.featuredLead} />
          <a href={href('shop', locale)} className="btn-secondary px-4 py-2 text-sm">
            {dict.common.seeAll}
          </a>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              dict={dict}
              priority={index < 2}
            />
          ))}
        </div>
      </section>

      <SizingBand locale={locale} dict={dict} />
      <WhyUs dict={dict} />
      <Process dict={dict} />
      <GuidesPreview locale={locale} dict={dict} />
      <SupportBand locale={locale} dict={dict} />
    </>
  );
}

/* ══════════════════════════════════════ SECTIONS ══════════════════════════════════════ */

function Hero({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDictionary> }) {
  const stats = [
    { value: dict.home.heroStatOne, label: dict.home.heroStatOneLabel },
    { value: dict.home.heroStatTwo, label: dict.home.heroStatTwoLabel },
    { value: dict.home.heroStatThree, label: dict.home.heroStatThreeLabel },
  ];

  return (
    <section className="ember-glow on-night relative overflow-hidden">
      <div className="container-page grid gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow-light">{dict.home.heroEyebrow}</p>

          <h1 className="mt-4 max-w-2xl text-[2.25rem] leading-[1.08] text-white md:text-[3.25rem]">
            {dict.home.heroTitle}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{dict.home.heroLead}</p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href={href('sizing', locale)} className="btn-ember">
              {dict.home.heroCtaPrimary}
            </a>
            <a href={href('shop', locale)} className="btn-outline-light">
              {dict.home.heroCtaSecondary}
            </a>
          </div>

          <dl className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-night-line pt-7 sm:gap-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="tabular font-display text-base font-semibold text-white sm:text-xl md:text-2xl">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs leading-snug text-white/50">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Visuel : une illustration, pas une photo — la mention le dit sur les fiches. */}
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute inset-x-6 bottom-6 top-10 rounded-full bg-flame/20 blur-3xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- illustration SVG, cf. product-image.tsx */}
          <img
            src="/img/placeholder/hero-stove.svg"
            alt=""
            width={520}
            height={620}
            className="relative mx-auto h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}

function TrustBar({ locale }: { locale: Locale }) {
  return (
    <section className="border-b border-line bg-cream">
      <ul className="container-page grid gap-x-8 gap-y-5 py-7 sm:grid-cols-2 lg:grid-cols-4">
        {promises.map((promise) => (
          <li key={promise.title[locale]} className="flex items-start gap-2.5">
            <CheckIcon />
            <span>
              <span className="block text-sm font-semibold text-ink">{promise.title[locale]}</span>
              <span className="block text-xs leading-snug text-muted">{promise.detail[locale]}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Families({
  locale,
  dict,
  airCount,
  hydroCount,
}: {
  locale: Locale;
  dict: ReturnType<typeof getDictionary>;
  airCount: number;
  hydroCount: number;
}) {
  const families = [
    {
      route: 'air' as const,
      title: dict.categories.air,
      tagline: dict.categories.airTagline,
      chooseIf: dict.home.airChooseIf,
      reasons: dict.home.airReasons,
      count: airCount,
      image: '/img/placeholder/family-air.svg',
    },
    {
      route: 'hydro' as const,
      title: dict.categories.hydro,
      tagline: dict.categories.hydroTagline,
      chooseIf: dict.home.hydroChooseIf,
      reasons: dict.home.hydroReasons,
      count: hydroCount,
      image: '/img/placeholder/family-hydro.svg',
    },
  ];

  return (
    <section className="container-page py-16 md:py-20">
      <SectionHeading
        eyebrow={dict.nav.shop}
        title={dict.home.familiesTitle}
        lead={dict.home.familiesLead}
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {families.map((family) => (
          <article key={family.route} className="card overflow-hidden">
            <div className="flex items-center gap-5 border-b border-line bg-sand px-6 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- illustration SVG */}
              <img src={family.image} alt="" width={92} height={92} className="h-20 w-20 shrink-0" />
              <div>
                <h3 className="text-xl">{family.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{family.tagline}</p>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm font-semibold text-ink">{family.chooseIf} :</p>
              <ul className="mt-3 space-y-2">
                {family.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ember" />
                    {reason}
                  </li>
                ))}
              </ul>

              <a href={href(family.route, locale)} className="btn-primary mt-6 w-full">
                {family.title} · {family.count} {dict.common.products}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SizingBand({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDictionary> }) {
  return (
    <section className="border-y border-line bg-sand">
      <div className="container-page flex flex-col items-start gap-7 py-14 md:flex-row md:items-center md:justify-between md:py-16">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2.5">{dict.nav.sizing}</p>
          <h2 className="text-2xl md:text-3xl">{dict.home.sizingTitle}</h2>
          <p className="mt-3 text-ink-soft">{dict.home.sizingLead}</p>
        </div>
        <a href={href('sizing', locale)} className="btn-ember shrink-0">
          {dict.home.sizingCta}
        </a>
      </div>
    </section>
  );
}

function WhyUs({ dict }: { dict: ReturnType<typeof getDictionary> }) {
  return (
    <section className="container-page py-16 md:py-20">
      <SectionHeading title={dict.home.whyTitle} />

      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {dict.home.whyItems.map((item, index) => (
          <article key={item.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-bold text-muted"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-lg">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Process({ dict }: { dict: ReturnType<typeof getDictionary> }) {
  return (
    <section className="border-t border-line bg-cream">
      <div className="container-page py-16 md:py-20">
        <SectionHeading title={dict.home.processTitle} align="center" />

        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {dict.home.processSteps.map((step, index) => (
            <li key={step.title} className="relative">
              <span
                aria-hidden="true"
                className="tabular font-display text-3xl font-semibold text-line"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-1 text-base">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function GuidesPreview({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDictionary> }) {
  return (
    <section className="container-page py-16 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading title={dict.home.guidesTitle} lead={dict.home.guidesLead} />
        <a href={href('guides', locale)} className="btn-secondary px-4 py-2 text-sm">
          {dict.common.seeAll}
        </a>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {guides.map((guide) => (
          <article key={guide.id} className="card flex flex-col p-6">
            <p className="eyebrow">
              {guide.readingMinutes} {dict.guides.readingTime}
            </p>
            <h3 className="mt-2 text-lg leading-snug">
              <a href={guideHref(guide.slug[locale], locale)} className="transition-colors hover:text-ember">
                {guide.title[locale]}
              </a>
            </h3>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-soft">
              {guide.description[locale]}
            </p>
            <p className="mt-4 text-xs text-muted">
              {dict.guides.updated} {formatDate(guide.updated, locale)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SupportBand({ locale, dict }: { locale: Locale; dict: ReturnType<typeof getDictionary> }) {
  const bestSeller = getHeroProducts()[0];

  return (
    <section className="container-page pb-4">
      <div className="ember-glow on-night grid items-center gap-8 rounded-2xl p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
        <div>
          <h2 className="text-2xl text-white md:text-3xl">{dict.home.supportTitle}</h2>
          <p className="mt-3 max-w-xl text-white/70">{dict.home.supportLead}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={href('contact', locale)} className="btn-ember">
              {dict.home.supportCta}
            </a>
            <a href={href('faq', locale)} className="btn-outline-light">
              {dict.faq.title}
            </a>
          </div>
        </div>

        {bestSeller ? (
          <a
            href={`${href('shop', locale)}`}
            className="flex items-center gap-4 rounded-xl border border-night-line bg-night-soft/70 p-4 transition-colors hover:border-flame/40"
          >
            <ProductImage
              image={primaryImage(bestSeller)}
              locale={locale}
              width={160}
              height={160}
              className="h-20 w-20 shrink-0 object-contain"
            />
            <span>
              <span className="block text-xs uppercase tracking-wider text-flame">
                {bestSeller.badge ? bestSeller.badge[locale] : dict.home.featuredTitle}
              </span>
              <span className="mt-1 block font-semibold text-white">{bestSeller.name}</span>
              <span className="tabular mt-0.5 block text-sm text-white/60">
                {priceShort(bestSeller.price, locale)} {dict.common.vatIncluded}
              </span>
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-1 shrink-0 text-ember"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8.5l3.5 3.5 7.5-8" />
    </svg>
  );
}
