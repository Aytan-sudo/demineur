// Ce que les chiffres racontent.
//
// Un plateau donne un nombre de mines voisines par case ; cette couche decide
// comment il s'affiche, et surtout ce qu'un joueur honnete peut en conclure.
// Elle produit deux choses pour chaque case :
//
//   libelles[i]  le texte a dessiner      (« 3 », « 2-3 »)
//   sommes[i]    les totaux encore possibles vus du joueur ([3], [2,3], [2,4])
//
// Le solveur ne travaille que sur `sommes` : c'est ce qui lui permet de rester
// exact quand les chiffres mentent, au lieu d'avoir une regle par variante.

export const MODES_CHIFFRES = {
    exacts: {
        libelle: 'Exacts',
        resume: 'Chaque chiffre dit la vérité.'
    },
    menteurs: {
        libelle: 'Menteurs',
        resume: 'Chaque chiffre est faux de un, en plus ou en moins. Jamais juste.'
    },
    flous: {
        libelle: 'Flous',
        resume: 'À partir de trois, les chiffres deviennent des fourchettes. Les petits restent nets.'
    }
};

// Le rythme : ce qui met fin a la partie, et comment le temps s'ecoule.
//
// `vies` a Infinity ne peut jamais tomber a zero, ce qui suffit a decrire le
// mode zen sans un seul « si » ailleurs dans le moteur.
export const RYTHMES = {
    classique: {
        libelle: 'Une vie',
        resume: 'Une mine et la partie s\'arrête. Le démineur tel qu\'on le connaît.',
        vies: 1
    },
    vies: {
        libelle: 'Trois vies',
        resume: 'Une mine coûte un cœur au lieu de finir la partie. Confortable au doigt.',
        vies: 3
    },
    zen: {
        libelle: 'Zen',
        resume: 'On ne perd jamais. Les mines touchées sont simplement neutralisées.',
        vies: Infinity
    },
    blitz: {
        libelle: 'Blitz',
        resume: 'Compte à rebours. Chaque case ouverte rend un peu de temps.',
        vies: 1,
        rebours: true
    }
};

// Temps de depart et bonus, tailles de grille comprises : une grille d'expert
// demande plus de clics qu'une facile, lui donner le meme chrono ne serait pas
// un defi mais une impossibilite.
export const compteARebours = ({ taille, mines }) => ({
    depart: Math.max(25000, Math.round(taille * 160)),
    parCase: 400 + Math.round((mines / taille) * 1500)
});

const entre = (valeur, minimum, maximum) => Math.max(minimum, Math.min(maximum, valeur));

// Un mensonge de plus ou moins un, borne par ce que la case peut porter.
function mentir(vrai, degre, aleatoire) {
    if (vrai === 0) return 1;
    if (vrai === degre) return degre - 1;
    return aleatoire() < 0.5 ? vrai - 1 : vrai + 1;
}

// Fourchette de deux valeurs contenant la verite.
//
// Seuls les chiffres a partir de trois sont brouilles. Tout brouiller rend la
// grille presque indeductible — une mesure sur des milliers de tirages donnait
// quatre grilles solubles sur cent — alors que laisser les 1 et les 2 nets
// garde des points d'appui : le flou frappe les zones denses, celles ou l'on
// comptait justement sur le chiffre exact.
const SEUIL_FLOU = 3;

function flouter(vrai, degre, aleatoire) {
    if (vrai < SEUIL_FLOU) return [vrai, vrai];
    const bas = entre(aleatoire() < 0.5 ? vrai - 1 : vrai, SEUIL_FLOU - 1, degre - 1);
    return [bas, bas + 1];
}

// `chiffres` est la verite du plateau, `mode` la variante choisie.
export function composerChiffres({ plateau, chiffres, mode = 'exacts', aleatoire = Math.random }) {
    const taille = plateau.taille;
    const libelles = new Array(taille);
    const sommes = new Array(taille);

    for (let index = 0; index < taille; index++) {
        const vrai = chiffres[index];
        const degre = plateau.voisins[index].length;

        if (mode === 'menteurs') {
            const affiche = mentir(vrai, degre, aleatoire);
            libelles[index] = String(affiche);
            sommes[index] = [affiche - 1, affiche + 1].filter(valeur => valeur >= 0 && valeur <= degre);
        } else if (mode === 'flous') {
            const [bas, haut] = flouter(vrai, degre, aleatoire);
            libelles[index] = bas === haut ? String(bas) : `${bas}-${haut}`;
            sommes[index] = bas === haut ? [bas] : [bas, haut];
        } else {
            libelles[index] = String(vrai);
            sommes[index] = [vrai];
        }
    }
    return { libelles, sommes };
}

// Verifie qu'un affichage n'a pas trahi la verite — utilise par les tests, et
// filet de securite du generateur : une grille dont l'affichage exclurait la
// vraie valeur serait insoluble sans que personne comprenne pourquoi.
export const affichageCoherent = ({ chiffres, sommes }) =>
    sommes.every((valeurs, index) => valeurs.includes(chiffres[index]));

// ------------------------------------------------------------- coherence

// Toutes les combinaisons ne se valent pas geometriquement. Plutot que de les
// interdire dans l'interface, on rectifie ce qui doit l'etre, a un seul
// endroit : le defi du jour et les reglages passent tous les deux par ici.
export function normaliser(config) {
    const corrige = { ...config };

    // Un hexagone ne se recolle proprement que sur un nombre pair de rangees :
    // sinon deux rangees de meme parite se retrouvent voisines et le voisinage
    // cesse d'etre reciproque.
    if (corrige.topologie === 'hexagone' && corrige.enroule && corrige.lignes % 2 === 1) {
        corrige.lignes -= 1;
    }

    // Sous six cases de cote, les sauts de cavalier ne relient plus toute la
    // grille : des ilots entiers deviendraient indeductibles.
    if (corrige.topologie === 'cavalier') {
        corrige.colonnes = Math.max(6, corrige.colonnes);
        corrige.lignes = Math.max(6, corrige.lignes);
    }

    corrige.mines = Math.max(1, Math.min(corrige.mines, corrige.colonnes * corrige.lignes - 9));
    return corrige;
}
