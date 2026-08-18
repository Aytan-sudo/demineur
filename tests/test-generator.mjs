import { creerPlateau, calculerChiffres } from '../js/board.js';
import { genererGrille, zoneProtegee } from '../js/generator.js';
import { resoudre } from '../js/solver.js';
import { counter, alea } from './harness.mjs';

const { check, report } = counter();
console.log('\nGenerateur\n');

const compter = mines => mines.reduce((total, valeur) => total + valeur, 0);

// ------------------------------------------------------- promesse du 1er clic

const plateau = creerPlateau({ colonnes: 9, lignes: 9 });
const hasard = alea(1234);

let departSain = true;
let ouvertureSaine = true;
let comptesJustes = true;

for (let essai = 0; essai < 40; essai++) {
    const depart = Math.floor(hasard() * plateau.taille);
    const { mines, chiffres } = genererGrille({ plateau, nbMines: 10, depart, aleatoire: hasard });

    if (mines[depart]) departSain = false;
    if (chiffres[depart] !== 0) ouvertureSaine = false;
    if (compter(mines) !== 10) comptesJustes = false;
}

check('le premier clic ne tombe jamais sur une mine', departSain);
check('le premier clic ouvre toujours une nappe', ouvertureSaine);
check('le nombre de mines demande est respecte', comptesJustes);

check('la zone protegee couvre le clic et son entourage',
    zoneProtegee(plateau, 40).size === 9);
check('la zone protegee se reduit dans un coin',
    zoneProtegee(plateau, 0).size === 4);

// ------------------------------------------------------------- sans hasard

for (const [colonnes, lignes, nbMines, nom] of [[9, 9, 10, 'facile'], [16, 16, 40, 'moyen'], [30, 16, 99, 'expert']]) {
    const grand = creerPlateau({ colonnes, lignes });
    let toutesGaranties = true;
    let toutesResolubles = true;
    let pireDuree = 0;

    for (let essai = 0; essai < 12; essai++) {
        const depart = Math.floor(hasard() * grand.taille);
        const resultat = genererGrille({ plateau: grand, nbMines, depart, aleatoire: hasard, budgetMs: 8000 });
        if (!resultat.garanti) toutesGaranties = false;
        pireDuree = Math.max(pireDuree, resultat.ms);

        // Le generateur affirme que la grille se termine sans deviner : on le
        // verifie par nous-memes plutot que de le croire sur parole.
        const controle = resoudre({
            plateau: grand,
            chiffres: resultat.chiffres,
            mines: resultat.mines,
            depart
        });
        if (!controle.resolu) toutesResolubles = false;
    }

    check(`${nom} : douze grilles garanties sans hasard`, toutesGaranties);
    check(`${nom} : chaque grille rendue se termine bien par la logique`, toutesResolubles);
    check(`${nom} : composee en moins d'une seconde (pire cas ${Math.round(pireDuree)} ms)`, pireDuree < 1000);
}

// ------------------------------------------------------------- mode classique

const sansGarantie = genererGrille({
    plateau, nbMines: 10, depart: 40, sansHasard: false, aleatoire: hasard
});
check('sans la garantie, la grille est rendue telle quelle',
    sansGarantie.garanti === false && sansGarantie.essais === 1);
check('le mode classique respecte lui aussi le premier clic',
    !sansGarantie.mines[40] && compter(sansGarantie.mines) === 10);

// --------------------------------------------------------------- densite forte

const dense = creerPlateau({ colonnes: 10, lignes: 10 });
const resultatDense = genererGrille({ plateau: dense, nbMines: 35, depart: 55, aleatoire: hasard, budgetMs: 8000 });
check('une grille tres dense reste composable sans hasard', resultatDense.garanti, resultatDense.essais);

// Budget epuise : plutot que de faire attendre le joueur indefiniment, le
// generateur rend la derniere grille en main et annonce qu'elle n'est pas
// garantie. L'interface s'en sert pour le dire en fin de partie.
const abandon = genererGrille({
    plateau: dense, nbMines: 40, depart: 55, aleatoire: hasard, budgetMs: 0
});
check('un budget epuise rend quand meme une grille jouable',
    abandon.garanti === false && compter(abandon.mines) === 40, abandon.essais);
check('la zone du premier clic reste sure meme en abandonnant',
    !abandon.mines[55] && [...dense.voisins[55]].every(voisin => !abandon.mines[voisin]));
check('les chiffres restent coherents avec les mines rendues',
    calculerChiffres(dense, abandon.mines).join() === abandon.chiffres.join());

report();
