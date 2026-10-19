/** Blocs de mise en page réutilisés par toutes les pages. */

import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-cream">
      <div className="container-page py-12 md:py-16">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="max-w-3xl text-3xl md:text-[2.75rem]">{title}</h1>
        {lead ? <p className="mt-4 max-w-2xl text-lg text-ink-soft">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
      <h2 className="text-2xl md:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 text-ink-soft">{lead}</p> : null}
    </div>
  );
}

/** Encart d'avertissement : limites d'un calcul, contraintes de livraison. */
export function Notice({
  title,
  children,
  tone = 'neutral',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'neutral' | 'warn';
}) {
  const tones = {
    neutral: 'border-line bg-cream text-ink-soft',
    warn: 'border-warn/25 bg-[#fdf6e7] text-[#6b4205]',
  } as const;

  return (
    <div className={`rounded-xl border p-5 text-sm leading-relaxed ${tones[tone]}`}>
      {title ? <p className="mb-1.5 font-semibold text-ink">{title}</p> : null}
      {children}
    </div>
  );
}
