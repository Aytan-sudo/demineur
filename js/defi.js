// La grille du jour : la meme pour tout le monde, sans serveur.
//
// La date sert de graine. Tout le reste — la taille, la forme du plateau, la
// sincerite des chiffres, le rythme — en decoule, ce qui fait tourner les
// variantes sans que personne ait a les chercher dans les reglages.

import { generateurAleatoire, graineDepuis, tirer } from './hasard.js';
import { normaliser, MODES_CHIFFRES, RYTHMES } from './variantes.js';
import { DIFFICULTES } from './engine.js';

export const cleDuJour = (date = new Date()) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
].join('-');

// Les poids disent le caractere du defi : souvent un demineur reconnaissable,
// parfois une variante qui surprend. Un defi trop exotique tous les jours
// lasserait autant qu'un defi toujours identique.
const FORMATS = [['facile', 2], ['moyen', 5], ['expert', 2]];
const PLATEAUX = [['carre', 6], ['hexagone', 3], ['cavalier', 1]];
const CHIFFRES = [['exacts', 6], ['menteurs', 2], ['flous', 2]];
const RYTHME = [['classique', 5], ['vies', 3], ['blitz', 1], ['zen', 1]];

export function defiDuJour(date = new Date()) {
    const cle = cleDuJour(date);
    const graine = graineDepuis(`demineur:${cle}`);
    const aleatoire = generateurAleatoire(graine);

    const format = tirer(FORMATS, aleatoire);
    const { colonnes, lignes, mines } = DIFFICULTES[format];

    const config = normaliser({
        difficulte: format,
        colonnes,
        lignes,
        mines,
        topologie: tirer(PLATEAUX, aleatoire),
        enroule: aleatoire() < 0.25,
        chiffres: tirer(CHIFFRES, aleatoire),
        rythme: tirer(RYTHME, aleatoire),
        sansHasard: true      // un defi partage ne se joue pas aux des
    });

    return { cle, graine, config, resume: resumeDe(config) };
}

// Phrase courte qui decrit la recette du jour, pour l'ecran et pour le partage.
export function resumeDe(config) {
    const morceaux = [DIFFICULTES[config.difficulte]?.libelle ?? 'Perso'];

    if (config.topologie === 'hexagone') morceaux.push('hexagones');
    if (config.topologie === 'cavalier') morceaux.push('cavalier');
    if (config.enroule) morceaux.push('bords recollés');
    if (config.chiffres !== 'exacts') morceaux.push(MODES_CHIFFRES[config.chiffres].libelle.toLowerCase());
    if (config.rythme !== 'classique') morceaux.push(RYTHMES[config.rythme].libelle.toLowerCase());

    return morceaux.join(' · ');
}

const formaterTemps = ms => {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function texteDePartage({ cle, resume, gagne, temps, avancement, indices, lien }) {
    const [annee, mois, jour] = cle.split('-');
    const lignes = [
        `Démineur du ${jour}/${mois}/${annee}`,
        resume,
        gagne
            ? `✅ ${formaterTemps(temps)}${indices > 0 ? ` · ${indices} indice${indices > 1 ? 's' : ''}` : ''}`
            : `💥 à ${Math.round(avancement * 100)} % de la grille`
    ];
    if (lien) lignes.push(lien);
    return lignes.join('\n');
}
