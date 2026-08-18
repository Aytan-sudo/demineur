// Geometrie du plateau : qui est le voisin de qui, et ou se dessine chaque case.
//
// Tout le reste du jeu (chiffres, solveur, generateur, regles) ne connait les
// cases que par leur index et par cette table de voisinage. C'est ce qui permet
// a une grille hexagonale ou a un voisinage de cavalier de ne rien changer au
// solveur : seule cette table bouge.

// Deplacements relatifs, en colonnes/lignes, pour chaque famille de plateau.
// L'hexagone depend de la parite de la ligne : ses rangees sont decalees d'une
// demi-case, alors les voisines du haut et du bas ne sont pas les memes selon
// qu'on se trouve sur une rangee avancee ou reculee.
const DEPLACEMENTS = {
    carre: () => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],

    hexagone: y => (y % 2 === 0
        ? [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]]
        : [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]),

    cavalier: () => [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
};

export const TOPOLOGIES = Object.keys(DEPLACEMENTS);

// La forme dessinee ne suit pas toujours le voisinage : le cavalier saute d'une
// case a l'autre sur une grille tout ce qu'il y a de plus carree.
export const geometrieDe = topologie => (topologie === 'hexagone' ? 'hexagone' : 'carre');

export function construireVoisins({ colonnes, lignes, topologie = 'carre', enroule = false }) {
    const deplacements = DEPLACEMENTS[topologie] ?? DEPLACEMENTS.carre;
    const taille = colonnes * lignes;
    const voisins = new Array(taille);

    for (let index = 0; index < taille; index++) {
        const x = index % colonnes;
        const y = (index - x) / colonnes;
        const liste = [];

        for (const [dx, dy] of deplacements(y)) {
            let vx = x + dx;
            let vy = y + dy;

            if (enroule) {
                vx = (vx + colonnes * 2) % colonnes;
                vy = (vy + lignes * 2) % lignes;
            } else if (vx < 0 || vx >= colonnes || vy < 0 || vy >= lignes) {
                continue;
            }
            liste.push(vy * colonnes + vx);
        }
        voisins[index] = Int32Array.from(new Set(liste));
    }
    return voisins;
}

export function creerPlateau({ colonnes, lignes, topologie = 'carre', enroule = false }) {
    return {
        colonnes,
        lignes,
        topologie,
        enroule,
        geometrie: geometrieDe(topologie),
        taille: colonnes * lignes,
        voisins: construireVoisins({ colonnes, lignes, topologie, enroule })
    };
}

// Nombre de mines adjacentes a chaque case. Les cases minees recoivent aussi
// leur compte : il sert a l'affichage post-mortem, jamais au jeu.
export function calculerChiffres(plateau, mines) {
    const chiffres = new Uint8Array(plateau.taille);
    for (let index = 0; index < plateau.taille; index++) {
        let compte = 0;
        for (const voisin of plateau.voisins[index]) {
            if (mines[voisin]) compte++;
        }
        chiffres[index] = compte;
    }
    return chiffres;
}

// Un voisinage doit toujours etre reciproque : si A voit B, B voit A. Sans
// cela, un chiffre pourrait compter une mine que sa voisine ignore, et la
// grille deviendrait indeductible. L'interface s'en sert pour refuser les
// combinaisons qui ne se recollent pas (un hexagone enroule sur un nombre
// impair de rangees, par exemple).
export const voisinageReciproque = plateau =>
    plateau.voisins.every((liste, index) =>
        [...liste].every(voisin => [...plateau.voisins[voisin]].includes(index)));

export const coordonnees = (plateau, index) => ({
    x: index % plateau.colonnes,
    y: Math.floor(index / plateau.colonnes)
});
