/**
 * Coordonnées bancaires affichées au client pour le virement.
 *
 * Elles viennent de l'environnement et jamais du code : un IBAN commité dans
 * un dépôt y reste pour toujours, y compris après changement de compte, et
 * tout clone du dépôt en emporte une copie.
 *
 * Ces valeurs sont PUBLIQUES par nature — un IBAN se communique à qui doit
 * vous payer, il ne permet pas de prélever. Elles n'en sont pas moins de la
 * configuration : les publier côté client depuis un `NEXT_PUBLIC_` les
 * figerait dans chaque page construite, alors qu'elles doivent pouvoir
 * changer sans reconstruction.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'bank.ts a été importé côté client : les coordonnées bancaires seraient figées dans chaque page construite. ' +
      'Déplacez cet import vers une route API ou un composant serveur.',
  );
}

function env(name: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : '';
}

export interface BankDetails {
  holder: string;
  iban: string;
  bic: string;
  bankName: string;
}

export function bankDetails(): BankDetails {
  return {
    holder: env('BANK_HOLDER'),
    iban: env('BANK_IBAN'),
    bic: env('BANK_BIC'),
    bankName: env('BANK_NAME'),
  };
}

/**
 * `false` tant que le titulaire et l'IBAN ne sont pas renseignés.
 *
 * La commande reste ouverte dans ce cas — le panier, le récapitulatif et le
 * formulaire fonctionnent — mais la page affiche un avertissement au lieu
 * d'un RIB vide, et l'exploitant voit immédiatement ce qui manque.
 */
export function isBankConfigured(): boolean {
  const { holder, iban } = bankDetails();
  return holder.length > 0 && iban.length > 0;
}

/**
 * IBAN groupé par quatre, comme sur un RIB imprimé.
 *
 * Ce n'est pas cosmétique : un IBAN de 27 caractères recopié à la main dans
 * un formulaire de virement se trompe d'un chiffre une fois sur trois. Le
 * groupage est la présentation que les banques utilisent précisément pour
 * cette raison.
 */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
