import type { Metadata } from 'next';
import { LegalPage, Todo } from '@/components/legal-prose';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Mentions légales',
  alternates: { canonical: '/mentions-legales' },
};

export default function Page() {
  return (
    <LegalPage title="Mentions légales" updated="9 octobre 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le site {brand.domain} est édité par <Todo>dénomination sociale</Todo>,{' '}
        <Todo>forme juridique : SAS, EURL, micro-entreprise…</Todo> au capital de{' '}
        <Todo>montant du capital</Todo>, immatriculée au registre du commerce et des sociétés de{' '}
        <Todo>ville du greffe</Todo> sous le numéro <Todo>SIREN</Todo>.
      </p>
      <ul>
        <li>Siège social : <Todo>adresse complète</Todo></li>
        <li>Numéro de TVA intracommunautaire : <Todo>FR + 11 chiffres</Todo></li>
        <li>Directeur de la publication : <Todo>nom du représentant légal</Todo></li>
        <li>Téléphone : <Todo>numéro de téléphone</Todo></li>
        <li>Courriel : {brand.email.support}</li>
      </ul>
      <p>
        Si votre activité est soumise a immatriculation particulière ou a une autorisation, la
        mention correspondante doit figurer ici : <Todo>le cas échéant</Todo>.
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <Todo>nom de l’hébergeur</Todo>,{' '}
        <Todo>adresse de l’hébergeur</Todo>, <Todo>téléphone de l’hébergeur</Todo>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus de ce site — textes, visuels, logos, fiches produits — est protégé
        par le droit d’auteur. Toute reproduction, même partielle, est interdite sans autorisation
        écrite préalable.
      </p>

      <h2>Médiation de la consommation</h2>
      <p>
        Conformément a l’article L. 612-1 du code de la consommation, tout consommateur a le droit
        de recourir gratuitement a un médiateur de la consommation en vue de la résolution amiable
        d’un litige. Notre médiateur est <Todo>nom et coordonnées du médiateur</Todo>.
      </p>
      <p>
        L’adhésion a un dispositif de médiation est une obligation légale pour tout vendeur en
        ligne a destination de consommateurs français : elle doit être souscrite avant la première
        vente.
      </p>
    </LegalPage>
  );
}
