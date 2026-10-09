import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Notre démarche',
  description:
    'Pourquoi onze références et pas trois cents, pourquoi un entrepôt européen, et ce que nous ne faisons pas.',
  alternates: { canonical: '/le-rituel' },
};

export default function AboutPage() {
  return (
    <div className="container-page py-14">
      <article className="mx-auto max-w-2xl">
        <p className="eyebrow">Notre démarche</p>
        <h1 className="mt-2 text-4xl">Onze références, et c’est voulu</h1>

        <div className="mt-8 space-y-6 text-[17px] leading-relaxed text-ink-soft">
          <p>
            La plupart des boutiques de matériel a café proposent des centaines de références. C’est
            commode pour le vendeur et épuisant pour l’acheteur : il faut arbitrer entre quarante
            drippers dont trente-huit se valent.
          </p>
          <p>
            Nous avons pris le problème a l’envers. Nous avons cherche les objets qui changent
            quelque chose de mesurable dans la tasse, et nous nous sommes arrêtés la. Un cône qui
            garde la chaleur. Une verseuse graduée aux volumes qu’on utilise vraiment. Une balance
            au décigramme. Un moulin a meules. Le reste est du confort.
          </p>

          <h2 className="pt-4 text-2xl text-ink">Ce que nous faisons</h2>
          <p>
            Nous sélectionnons, nous documentons, nous expédions depuis un entrepôt aux Pays-Bas.
            Nous ne fabriquons pas ces objets : ils viennent de fabricants qui les produisent pour
            plusieurs marques, et nous ne prétendons pas le contraire. Ce que nous apportons, c’est
            la sélection, l’information et un interlocuteur qui répond.
          </p>

          <h2 className="pt-4 text-2xl text-ink">Ce que nous ne faisons pas</h2>
          <ul className="space-y-2.5">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                &bull;
              </span>
              <span>
                <strong className="text-ink">Pas de faux avis.</strong> Vous ne verrez pas d’étoiles
                sur ce site tant que nous n’aurons pas de vrais clients pour les écrire. Un avis
                fabriqué est une pratique commerciale trompeuse, et c’est aussi la façon la plus
                rapide de perdre la confiance qu’on cherchait a gagner.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                &bull;
              </span>
              <span>
                <strong className="text-ink">Pas de faux compte a rebours.</strong> Aucune offre ne
                se termine dans dix-sept minutes. Les prix barres correspondent au total des
                articles achetés séparément, vérifiable sur leurs fiches.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 font-semibold text-accent">
                &bull;
              </span>
              <span>
                <strong className="text-ink">Pas de promesse de délai intenable.</strong> Deux a
                quatre jours ouvrés en France, parce que le colis part d’Europe. Nous ne promettons
                pas le lendemain.
              </span>
            </li>
          </ul>

          <h2 className="pt-4 text-2xl text-ink">Nous écrire</h2>
          <p>
            Une question sur un réglage, un colis, un retour : {brand.email.support}. Réponse sous
            24 heures ouvrées, par un humain.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/produits" className="btn-primary">
            Voir la boutique
          </Link>
          <Link href="/guides/reussir-son-cafe-filtre" className="btn-secondary">
            Lire le guide d’infusion
          </Link>
        </div>
      </article>
    </div>
  );
}
