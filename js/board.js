// Geometrie du plateau : qui est le voisin de qui.
//
// Tout le reste du jeu (chiffres, solveur, generateur, rendu) ne connait les
// cases que par leur index et par cette table de voisinage. C'est le seul
// endroit a toucher pour ajouter une variante de plateau : une grille
// hexagonale ou un voisinage de cavalier ne changent que `construireVoisins`,
// pas une ligne du solveur.

// Grille rectangulaire, voisinage des 8 cases entourantes.
// `enroule` recolle les bords entre eux (tore) : plus aucun coin n'est
// avantage, chaque case a exactement 8 voisins.
export function construireVoisins({ colonnes, lignes, enroule = false }) {
    const taille = colonnes * lignes;
    const voisins = new Array(taille);

    for (let index = 0; index < taille; index++) {
        const x = index % colonnes;
        const y = (index - x) / colonnes;
        const liste = [];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                let vx = x + dx;
                let vy = y + dy;

                if (enroule) {
                    vx = (vx + colonnes) % colonnes;
                    vy = (vy + lignes) % lignes;
                } else if (vx < 0 || vx >= colonnes || vy < 0 || vy >= lignes) {
                    continue;
                }
                liste.push(vy * colonnes + vx);
            }
        }
        voisins[index] = Int32Array.from(liste);
    }
    return voisins;
}

export function creerPlateau({ colonnes, lignes, enroule = false }) {
    return {
        colonnes,
        lignes,
        enroule,
        taille: colonnes * lignes,
        voisins: construireVoisins({ colonnes, lignes, enroule })
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

export const coordonnees = (plateau, index) => ({
    x: index % plateau.colonnes,
    y: Math.floor(index / plateau.colonnes)
});

export const indexDe = (plateau, x, y) => y * plateau.colonnes + x;
