// Placement des mines.
//
// Le premier clic n'est jamais perdant, et il ouvre toujours une zone : les
// mines sont posees apres ce clic, en tenant a l'ecart la case touchee et ses
// voisines. Sans cette regle, une partie sur trois commence par un chiffre isole
// et un pur coup de des.
//
// En mode sans hasard, on va plus loin : la grille n'est retenue que si le
// solveur la termine par la seule logique. Une grille refusee n'est pas jetee
// pour autant — on deplace une des mines qui bloquent la deduction et on
// retente. Repartir de zero a chaque fois marche aussi, mais converge beaucoup
// moins vite des que la densite monte.

import { calculerChiffres } from './board.js';
import { resoudre } from './solver.js';
import { composerChiffres } from './variantes.js';

const melanger = (liste, aleatoire) => {
    for (let i = liste.length - 1; i > 0; i--) {
        const j = Math.floor(aleatoire() * (i + 1));
        [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    return liste;
};

// Cases ou l'on s'interdit de poser une mine : le premier clic et son entourage.
export function zoneProtegee(plateau, depart) {
    return new Set([depart, ...plateau.voisins[depart]]);
}

function placerAuHasard(plateau, nbMines, protegees, aleatoire) {
    const candidates = [];
    for (let index = 0; index < plateau.taille; index++) {
        if (!protegees.has(index)) candidates.push(index);
    }
    melanger(candidates, aleatoire);

    const mines = new Uint8Array(plateau.taille);
    for (const index of candidates.slice(0, nbMines)) mines[index] = 1;
    return mines;
}

// Deplace une mine genante vers une case tiree au sort ailleurs. On choisit la
// mine parmi celles qui participent au blocage : bouger une mine a l'autre bout
// de la grille ne changerait rien a l'ambiguite constatee.
function deplacerUneMine(plateau, mines, bloquantes, protegees, aleatoire) {
    const genantes = bloquantes.filter(index => mines[index]);
    if (genantes.length === 0) return false;

    const accueil = [];
    const interdites = new Set(bloquantes);
    for (let index = 0; index < plateau.taille; index++) {
        if (!mines[index] && !protegees.has(index) && !interdites.has(index)) accueil.push(index);
    }
    if (accueil.length === 0) return false;

    mines[genantes[Math.floor(aleatoire() * genantes.length)]] = 0;
    mines[accueil[Math.floor(aleatoire() * accueil.length)]] = 1;
    return true;
}

// Renvoie { mines, chiffres, libelles, sommes, garanti, essais, ms }.
//
// `garanti` dit si la grille rendue est bien resoluble sans deviner : en mode
// sans hasard on peut manquer de temps sur une densite extreme, et il vaut mieux
// rendre une grille classique en le disant que de faire attendre le joueur.
//
// L'affichage fait partie du tirage. Avec des chiffres menteurs ou flous, deux
// grilles identiques ne se valent pas selon la facon dont les chiffres sont
// maquilles : le mensonge se rejoue donc a chaque tentative, au meme titre que
// la position des mines.
export function genererGrille({
    plateau,
    nbMines,
    depart,
    sansHasard = true,
    modeChiffres = 'exacts',
    aleatoire = Math.random,
    budgetMs = 4000,
    maintenant = () => Date.now()
}) {
    const protegees = zoneProtegee(plateau, depart);
    const mines = placerAuHasard(plateau, nbMines, protegees, aleatoire);

    let chiffres = calculerChiffres(plateau, mines);
    let affichage = composerChiffres({ plateau, chiffres, mode: modeChiffres, aleatoire });

    const resultat = (garanti, essais, ms) => ({
        mines, chiffres, libelles: affichage.libelles, sommes: affichage.sommes, garanti, essais, ms
    });

    if (!sansHasard) return resultat(false, 1, 0);

    const debut = maintenant();
    let essais = 0;

    while (maintenant() - debut < budgetMs) {
        essais++;
        const { resolu, bloquantes } = resoudre({
            plateau, chiffres, sommes: affichage.sommes, mines, depart
        });
        if (resolu) return resultat(true, essais, maintenant() - debut);

        // Une retouche locale suffit le plus souvent ; sinon on rebat les cartes.
        if (!deplacerUneMine(plateau, mines, bloquantes, protegees, aleatoire)) {
            mines.set(placerAuHasard(plateau, nbMines, protegees, aleatoire));
        }
        chiffres = calculerChiffres(plateau, mines);
        affichage = composerChiffres({ plateau, chiffres, mode: modeChiffres, aleatoire });
    }

    return resultat(false, essais, maintenant() - debut);
}
