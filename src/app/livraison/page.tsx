import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-prose';
import { formatPrice } from '@/lib/money';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

export const metadata: Metadata = {
  title: 'Livraison',
  description: 'Délais, tarifs et pays desservis. Expédition depuis l’Union européenne.',
  alternates: { canonical: '/livraison' },
};

export default function Page() {
  return (
    <LegalPage title="Livraison" updated="9 octobre 2026">
      <h2>Depuis l’Europe, pas depuis l’Asie</h2>
      <p>
        Notre entrepôt est situé aux Pays-Bas. C’est un choix de fond : un colis parti d’Asie
        arrive en deux a quatre semaines, ce qui transforme chaque commande en source d’inquiétude
        et chaque retour en casse-tete. Nos délais sont de quelques jours.
      </p>

      <h2>Délais et tarifs</h2>
      <ul>
        <li>France metropolitaine — Colissimo suivi, 2 a 4 jours ouvrés, 4,90 €.</li>
        <li>France metropolitaine — Chronopost express, 1 a 2 jours ouvrés, 9,90 €.</li>
        <li>
          Belgique, Luxembourg, Allemagne, Pays-Bas, Espagne, Italie, Portugal, Autriche, Irlande —
          3 a 6 jours ouvrés, 7,90 €.
        </li>
        <li>
          Livraison offerte dans tous les pays desservis a partir de{' '}
          {formatPrice(FREE_SHIPPING_THRESHOLD)} d’achat.
        </li>
      </ul>
      <p>
        Les délais s’entendent a compter de l’expédition, et non de la commande. La préparation
        demande un a deux jours ouvrés.
      </p>

      <h2>Suivi</h2>
      <p>
        Vous recevez un numéro de suivi par courriel des que le colis quitte l’entrepôt. L’état de
        votre commande est consultable a tout moment depuis la page de suivi, avec votre référence
        et votre adresse électronique.
      </p>

      <h2>Colis en retard</h2>
      <p>
        Si le suivi n’évolue plus depuis 48 heures, ecrivez-nous. Nous ouvrons une enquête auprès
        du transporteur et, si le colis est perdu, nous réexpédions sans attendre l’issue de la
        procédure.
      </p>
    </LegalPage>
  );
}
