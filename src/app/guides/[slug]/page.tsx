import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/product-card';
import { guides, getGuide } from '@/lib/guides';
import { getProductById } from '@/lib/catalog';
import { brand } from '@/lib/brand';

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: 'Guide introuvable' };

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { type: 'article', title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const related = guide.relatedProducts
    .map((id) => getProductById(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    author: { '@type': 'Organization', name: brand.name },
    publisher: { '@type': 'Organization', name: brand.name },
    mainEntityOfPage: `${brand.url}/guides/${guide.slug}`,
  };

  return (
    <div className="container-page py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="mx-auto max-w-2xl">
        <nav aria-label="Fil d’Ariane" className="text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            Accueil
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-ink-soft">Guides</span>
        </nav>

        <h1 className="mt-5 text-3xl sm:text-4xl">{guide.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {guide.readingMinutes} min de lecture — mis à jour le {guide.updated}
        </p>

        <p className="mt-7 text-lg leading-relaxed text-ink-soft">{guide.intro}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-4 space-y-2">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[15px] text-ink-soft">
                    <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                      &bull;
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <nav className="mt-14 border-t border-line pt-8">
          <h2 className="text-xl">Autres guides</h2>
          <ul className="mt-4 space-y-3">
            {guides
              .filter((g) => g.slug !== guide.slug)
              .map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`} className="font-semibold hover:text-accent">
                    {g.title}
                  </Link>
                  <p className="text-sm text-muted">{g.description}</p>
                </li>
              ))}
          </ul>
        </nav>
      </article>

      {related.length > 0 && (
        <section className="mt-16 border-t border-line pt-12">
          <h2 className="text-2xl">Le matériel dont parle ce guide</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
