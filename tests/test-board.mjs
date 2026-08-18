import { creerPlateau, construireVoisins, calculerChiffres } from '../js/board.js';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nPlateau\n');

const plateau = creerPlateau({ colonnes: 4, lignes: 3 });

check('taille = colonnes x lignes', plateau.taille === 12);
check('un coin a trois voisins', plateau.voisins[0].length === 3, [...plateau.voisins[0]]);
check('un bord a cinq voisins', plateau.voisins[1].length === 5, [...plateau.voisins[1]]);
check('le centre a huit voisins', plateau.voisins[5].length === 8, [...plateau.voisins[5]]);
check('les voisins du coin sont les bons',
    [...plateau.voisins[0]].sort((a, b) => a - b).join(',') === '1,4,5');

check('le voisinage est symetrique', plateau.voisins.every((liste, index) =>
    [...liste].every(voisin => [...plateau.voisins[voisin]].includes(index))));

check('aucune case n\'est sa propre voisine',
    plateau.voisins.every((liste, index) => ![...liste].includes(index)));

// Le tore n'est pas propose dans l'interface, mais le voisinage est le point
// d'extension des variantes de plateau : il doit rester juste.
const tore = creerPlateau({ colonnes: 4, lignes: 3, enroule: true });
check('sur un tore, toutes les cases ont huit voisins',
    tore.voisins.every(liste => liste.length === 8));
check('sur un tore, les bords se rejoignent',
    [...tore.voisins[0]].includes(3) && [...tore.voisins[0]].includes(8));

const mines = new Uint8Array(12);
mines[5] = 1;
const chiffres = calculerChiffres(plateau, mines);
check('les chiffres comptent les mines voisines', chiffres[0] === 1 && chiffres[6] === 1);
check('une case loin de toute mine vaut zero', chiffres[3] === 0);
check('la case minee porte le compte de ses propres voisines', chiffres[5] === 0);

check('construireVoisins accepte une grille d\'une seule ligne',
    construireVoisins({ colonnes: 3, lignes: 1 })[1].length === 2);

report();
