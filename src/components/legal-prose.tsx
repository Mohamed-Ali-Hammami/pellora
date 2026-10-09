import type { ReactNode } from 'react';

/**
 * Mise en forme commune des pages légales + avertissement sur les champs
 * manquants.
 *
 * Les mentions marquées `A COMPLETER` ne sont pas un oubli : publier des
 * coordonnées d’entreprise inventées serait sans valeur juridique et
 * constituerait une pratique commerciale trompeuse. Elles doivent être
 * remplies par les informations réelles de la société avant mise en ligne.
 */
export function TodoBanner() {
  return (
    <div className="not-prose mb-8 rounded-card border-2 border-warn bg-accent-soft p-5">
      <p className="font-semibold text-warn">Page a compléter avant mise en ligne</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        Les champs notes <code className="font-mono text-warn">[A COMPLETER]</code> doivent recevoir
        les informations réelles de votre société (dénomination, forme juridique, SIREN, adresse,
        hébergeur, médiateur de la consommation). Ce texte est une base de travail, pas un avis
        juridique : faites-le relire avant d’encaisser votre première commande.
      </p>
    </div>
  );
}

export function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-accent-soft px-1 font-mono text-sm text-warn">
      [A COMPLETER : {children}]
    </mark>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-14">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Dernière mise à jour : {updated}</p>
        <div className="mt-8">
          <TodoBanner />
        </div>
        <div className="space-y-6 text-[15px] leading-relaxed text-ink-soft [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
    </div>
  );
}
