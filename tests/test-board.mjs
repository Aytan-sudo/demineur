import { creerPlateau, construireVoisins, calculerChiffres, voisinageReciproque, TOPOLOGIES } from '../js/board.js';
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

const tore = creerPlateau({ colonnes: 4, lignes: 4, enroule: true });
check('sur un tore, toutes les cases ont huit voisins',
    tore.voisins.every(liste => liste.length === 8));
check('sur un tore, les bords se rejoignent',
    [...tore.voisins[0]].includes(3) && [...tore.voisins[0]].includes(12));

// ------------------------------------------------------------- topologies

const hexagone = creerPlateau({ colonnes: 6, lignes: 6, topologie: 'hexagone' });
check('un hexagone du centre a six voisins', hexagone.voisins[14].length === 6);
check('l\'hexagone se dessine comme un hexagone', hexagone.geometrie === 'hexagone');
check('les rangees decalees ne se decalent pas dans le meme sens',
    [...hexagone.voisins[7]].join() !== [...hexagone.voisins[13]].join());

const cavalier = creerPlateau({ colonnes: 8, lignes: 8, topologie: 'cavalier' });
check('le cavalier saute en L', cavalier.voisins[27].length === 8);
check('le cavalier ne voit pas ses cases adjacentes',
    ![...cavalier.voisins[27]].includes(28) && ![...cavalier.voisins[27]].includes(19));
check('le cavalier se dessine sur une grille carree', cavalier.geometrie === 'carre');

// Un voisinage qui n'est pas reciproque rendrait la grille indeductible : une
// case compterait une mine que sa voisine ignore. C'est la seule contrainte
// geometrique dure du jeu.
let reciproques = true;
for (const topologie of TOPOLOGIES) {
    for (const enroule of [false, true]) {
        // L'hexagone enroule exige un nombre pair de rangees ; c'est
        // `normaliser` qui s'en charge, teste ailleurs.
        const lignes = topologie === 'hexagone' && enroule ? 8 : 9;
        if (!voisinageReciproque(creerPlateau({ colonnes: 9, lignes, topologie, enroule }))) {
            reciproques = false;
        }
    }
}
check('toutes les topologies ont un voisinage reciproque', reciproques);

check('un hexagone enroule sur un nombre impair de rangees ne se recolle pas',
    !voisinageReciproque(creerPlateau({ colonnes: 9, lignes: 9, topologie: 'hexagone', enroule: true })));

const mines = new Uint8Array(12);
mines[5] = 1;
const chiffres = calculerChiffres(plateau, mines);
check('les chiffres comptent les mines voisines', chiffres[0] === 1 && chiffres[6] === 1);
check('une case loin de toute mine vaut zero', chiffres[3] === 0);
check('la case minee porte le compte de ses propres voisines', chiffres[5] === 0);

check('construireVoisins accepte une grille d\'une seule ligne',
    construireVoisins({ colonnes: 3, lignes: 1 })[1].length === 2);

report();
