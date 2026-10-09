import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-prose';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Retours et remboursements',
  description:
    'Droit de rétractation de 14 jours, étendu à 30 jours. Procédure de retour et délais de remboursement.',
  alternates: { canonical: '/retours' },
};

export default function Page() {
  return (
    <LegalPage title="Retours et remboursements" updated="9 octobre 2026">
      <h2>Trente jours pour changer d’avis</h2>
      <p>
        La loi vous accorde quatorze jours pour vous rétracter sans motif. Nous portons ce délai à
        trente jours à compter de la réception de votre colis.
      </p>

      <h2>Comment procéder</h2>
      <ul>
        <li>
          Écrivez à {brand.email.support} en indiquant votre référence de commande. Une demande
          claire suffit : aucun formulaire imposé.
        </li>
        <li>Nous répondons sous 24 heures ouvrées avec l’adresse de retour.</li>
        <li>
          Renvoyez les produits dans un état permettant leur remise en vente, emballage d’origine
          si possible.
        </li>
      </ul>

      <h2>Frais de retour</h2>
      <p>
        Les frais de renvoi sont à votre charge pour un retour de confort. Ils sont à la notre si
        le produit est défectueux, non conforme, ou si nous nous sommes trompes dans la
        préparation : nous envoyons alors une étiquette prépayée.
      </p>

      <h2>Remboursement</h2>
      <p>
        Le remboursement est émis dans les quatorze jours suivant la réception du retour, sur le
        moyen de paiement utilise lors de l’achat. Les frais de livraison initiaux sont rembourses
        pour un retour total ; ils ne le sont pas pour un retour partiel.
      </p>

      <h2>Produit casse à l’arrivée</h2>
      <p>
        Prenez une photo du colis et du produit, et envoyez-la nous dans les trois jours. Nous
        réexpédions immédiatement, sans attendre le retour de l’article abîmé : vous n’avez pas à
        avancer les conséquences d’un transport rate.
      </p>
    </LegalPage>
  );
}
