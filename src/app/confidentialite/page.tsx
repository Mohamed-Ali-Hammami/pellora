import type { Metadata } from 'next';
import { LegalPage, Todo } from '@/components/legal-prose';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Données personnelles',
  alternates: { canonical: '/confidentialite' },
};

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité" updated="9 octobre 2026">
      <h2>Responsable du traitement</h2>
      <p>
        <Todo>dénomination sociale</Todo>, <Todo>adresse complète</Todo>. Pour toute question
        relative a vos données : {brand.email.support}.
      </p>

      <h2>Données collectées et finalités</h2>
      <ul>
        <li>
          <strong>Exécution de la commande</strong> — nom, adresse de livraison, adresse
          électronique, téléphone. Base légale : exécution du contrat. Ces données sont transmises
          au transporteur et au fournisseur chargé de l’expédition, qui en sont destinataires au
          sens du RGPD.
        </li>
        <li>
          <strong>Paiement</strong> — traite par Stripe Payments Europe Ltd. Nous ne recevons ni ne
          conservons aucune donnée de carte bancaire. Base légale : exécution du contrat.
        </li>
        <li>
          <strong>Obligations comptables</strong> — factures et justificatifs, conserves dix ans
          conformément a l’article L. 123-22 du code de commerce. Base légale : obligation légale.
        </li>
        <li>
          <strong>Mesure d’audience</strong> — <Todo>outil employé, ou « aucun »</Todo>. Si l’outil
          dépose des traceurs non essentiels, votre consentement préalable est requis.
        </li>
      </ul>

      <h2>Sous-traitants et transferts</h2>
      <p>
        Nos prestataires techniques sont : <Todo>hébergeur</Todo> (hébergement),{' '}
        Stripe (paiement), <Todo>prestataire d’envoi d’e-mails</Todo> (courriels transactionnels),{' '}
        <Todo>fournisseur logistique</Todo> (préparation et expédition). Lorsqu’un transfert hors
        de l’Union européenne est nécessaire, il est encadre par les clauses contractuelles types
        de la Commission européenne.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Données de commande : 3 ans a compter du dernier contact, hors obligations comptables.</li>
        <li>Pièces comptables : 10 ans.</li>
        <li>Traceurs : 13 mois au maximum.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation,
        d’opposition et de portabilité. Vous pouvez les exercer a {brand.email.support}. Nous
        répondons dans un délai d’un mois.
      </p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la Commission nationale de
        l’informatique et des libertés (CNIL), 3 place de Fontenoy, 75007 Paris.
      </p>

      <h2>Traceurs</h2>
      <p>
        Ce site dépose un unique stockage local, nommé <code>verseuse.cart.v1</code>, qui conserve
        le contenu de votre panier. Il est strictement nécessaire au fonctionnement du service et
        ne requiert donc pas de consentement. Il ne contient aucune donnée d’identification et
        n’est jamais transmis a un tiers.
      </p>
      <p>
        Si vous ajoutez un outil de mesure d’audience ou un pixel publicitaire, un bandeau de
        consentement conforme devient obligatoire avant tout dépôt de traceur.
      </p>
    </LegalPage>
  );
}
