import type { Metadata } from 'next';
import { LegalPage, Todo } from '@/components/legal-prose';
import { brand } from '@/lib/brand';
import { formatPrice } from '@/lib/money';
import { FREE_SHIPPING_THRESHOLD, SHIPPING_COUNTRIES } from '@/lib/shipping';

export const metadata: Metadata = {
  title: 'Conditions générâles de vente',
  alternates: { canonical: '/cgv' },
};

export default function Page() {
  return (
    <LegalPage title="Conditions générâles de vente" updated="9 octobre 2026">
      <h2>1. Objet et champ d’application</h2>
      <p>
        Les présentes conditions régissent les ventes conclues sur {brand.domain} entre{' '}
        <Todo>dénomination sociale</Todo> (« le vendeur ») et tout consommateur ou non-professionnel
        (« le client »). Elles sont acceptées par le client avant la validation de sa commande.
      </p>

      <h2>2. Produits</h2>
      <p>
        Les produits proposés sont décrits avec la plus grande exactitude possible. Les
        caractéristiques essentielles figurent sur chaque fiche produit. Les visuels sont
        contractuels dans la limite des tolérances d’affichage des écrans.
      </p>

      <h2>3. Prix</h2>
      <p>
        Les prix sont indiques en euros, toutes taxes comprises, hors frais de livraison. Le taux
        de TVA applicable est celui en vigueur au jour de la commande. Les frais de livraison sont
        indiques avant la validation définitive et sont offerts à partir de{' '}
        {formatPrice(FREE_SHIPPING_THRESHOLD)} d’achat.
      </p>
      <p>
        Le vendeur se réserve le droit de modifier ses prix à tout moment ; les produits sont
        factures sur la base du tarif en vigueur au moment de l’enregistrement de la commande.
      </p>

      <h2>4. Commande</h2>
      <p>
        La commande est définitive après validation du paiement. Un courriel de confirmation
        récapitulant la commande est adresse au client. Le vendeur se réserve le droit de refuser
        une commande en cas de litige antérieur, de suspicion de fraude ou d’indisponibilité.
      </p>

      <h2>5. Paiement</h2>
      <p>
        Le paiement s’effectue par carte bancaire, Apple Pay ou Google Pay via le prestataire
        Stripe Payments Europe Ltd. Aucune donnée bancaire n’est collectée ni conservée par le
        vendeur. Les sommes ne sont encaissées qu’après autorisation de l’émetteur de la carte.
      </p>

      <h2>6. Livraison</h2>
      <p>
        Les produits sont expédiés vers les pays suivants : {SHIPPING_COUNTRIES.join(', ')}. Le
        délai de livraison estimé est de 2 à 4 jours ouvrés en France metropolitaine et de 3 à 6
        jours ouvrés dans les autres pays desservis, à compter de l’expédition.
      </p>
      <p>
        Conformément à l’article L. 216-1 du code de la consommation, le vendeur livre au plus tard
        trente jours après la conclusion du contrat. À défaut, le client peut résoudre le contrat
        après mise en demeure restée infructueuse.
      </p>
      <p>
        Le transfert des risques s’opère à la remise physique du colis au client. Toute avarie doit
        être signalée dans les trois jours, réserves écrites à l’appui.
      </p>

      <h2>7. Droit de rétractation</h2>
      <p>
        Le client dispose d’un délai de quatorze jours à compter de la réception pour exercer son
        droit de rétractation sans motif ni pénalité. Le vendeur accorde contractuellement un délai
        étendu à trente jours.
      </p>
      <p>
        Les frais de retour sont à la charge du client, sauf produit non conforme ou défectueux. Le
        remboursement intervient dans les quatorze jours suivant la récupération des produits, par
        le même moyen de paiement.
      </p>
      <p>
        Pour exercer ce droit, il suffit d’adresser une demande non ambiguë à{' '}
        {brand.email.support}, ou d’utiliser le formulaire type figurant en annexe à l’article
        R. 221-1 du code de la consommation.
      </p>

      <h2>8. Garanties légales</h2>
      <p>
        Indépendamment de toute garantie commerciale, le vendeur reste tenu de la garantie légale
        de conformité (articles L. 217-3 et suivants du code de la consommation), d’une durée de
        deux ans à compter de la délivrance, et de la garantie des vices cachés (articles 1641 et
        suivants du code civil).
      </p>
      <p>
        Dans le cadre de la garantie légale de conformité, le client choisit entre la réparation et
        le remplacement, sous réserve des conditions de coût prévues à l’article L. 217-12. Il est
        dispense de rapporter la preuve du défaut pendant les vingt-quatre mois suivant la
        délivrance.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans notre{' '}
        <a href="/confidentialite" className="text-accent underline">
          politique de confidentialité
        </a>
        .
      </p>

      <h2>10. Règlement des litiges</h2>
      <p>
        En cas de difficulté, le client s’adresse en priorité au service client. À défaut d’accord,
        il peut saisir gratuitement le médiateur de la consommation :{' '}
        <Todo>nom et coordonnées du médiateur</Todo>. La plateforme européenne de règlement en
        ligne des litiges est accessible aux consommateurs de l’Union.
      </p>
      <p>
        Les présentes conditions sont soumises au droit français. Aucune clause ne prive le
        consommateur du droit de saisir la juridiction de son lieu de résidence.
      </p>
    </LegalPage>
  );
}
