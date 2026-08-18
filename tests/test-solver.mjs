import { creerPlateau, calculerChiffres } from '../js/board.js';
import { deduire, resoudre, INCONNU, REVELE, MINE } from '../js/solver.js';
import { counter, alea, grilleManuelle } from './harness.mjs';

const { check, report } = counter();
console.log('\nSolveur\n');

// ------------------------------------------------------- deductions simples

const plateau = creerPlateau({ colonnes: 4, lignes: 4 });
const { mines, chiffres } = grilleManuelle(plateau, [0], calculerChiffres);

// Case 1 revelee, chiffre 1, seule inconnue voisine : la case 0.
const etat = new Uint8Array(plateau.taille);
for (const index of [1, 2, 3, 5, 6, 7]) etat[index] = REVELE;
etat[4] = REVELE;

let trouve = deduire({ plateau, chiffres, etat, minesTotales: 1 }, 1);
check('la regle triviale designe la mine', trouve.mines.includes(0), trouve);

// Un chiffre 0 rend toutes ses voisines sures.
const vide = new Uint8Array(plateau.taille);
vide[10] = REVELE;
trouve = deduire({ plateau, chiffres: calculerChiffres(plateau, new Uint8Array(16)), etat: vide, minesTotales: 0 }, 1);
check('un zero ouvre tout son entourage', trouve.sures.length === 8, trouve.sures);

// ------------------------------------------- l'etage 3 sert-il vraiment ?

// On rejoue des grilles au hasard ; a chaque blocage des deux premiers etages,
// on regarde ce que l'enumeration ajoute — et on verifie qu'elle ne se trompe
// jamais, en confrontant ses conclusions aux vraies mines.
function partiesAuHasard({ colonnes, lignes, nbMines, tirages, graine }) {
    const hasard = alea(graine);
    const bilan = { enumerationDecisive: 0, fautes: 0, etatsExamines: 0 };
    const plateauLocal = creerPlateau({ colonnes, lignes });
    const taille = colonnes * lignes;

    for (let tirage = 0; tirage < tirages; tirage++) {
        const depart = Math.floor(hasard() * taille);
        const interdits = new Set([depart, ...plateauLocal.voisins[depart]]);
        const libres = [...Array(taille).keys()].filter(index => !interdits.has(index));
        for (let i = libres.length - 1; i > 0; i--) {
            const j = Math.floor(hasard() * (i + 1));
            [libres[i], libres[j]] = [libres[j], libres[i]];
        }
        const verite = new Uint8Array(taille);
        for (const index of libres.slice(0, nbMines)) verite[index] = 1;
        const chiffresLocaux = calculerChiffres(plateauLocal, verite);

        // On avance a la logique, en notant ce que chaque etage apporte.
        const vue = new Uint8Array(taille);
        const ouvrir = index => {
            const pile = [index];
            while (pile.length) {
                const courant = pile.pop();
                if (vue[courant] === REVELE) continue;
                vue[courant] = REVELE;
                if (chiffresLocaux[courant] === 0) {
                    for (const voisin of plateauLocal.voisins[courant]) {
                        if (vue[voisin] !== REVELE) pile.push(voisin);
                    }
                }
            }
        };
        ouvrir(depart);

        for (let tour = 0; tour < 400; tour++) {
            bilan.etatsExamines++;
            const local = deduire({ plateau: plateauLocal, chiffres: chiffresLocaux, etat: vue, minesTotales: nbMines }, 2);
            let resultat = local;

            if (local.sures.length === 0 && local.mines.length === 0) {
                resultat = deduire({ plateau: plateauLocal, chiffres: chiffresLocaux, etat: vue, minesTotales: nbMines }, 3);
                if (resultat.sures.length > 0 || resultat.mines.length > 0) bilan.enumerationDecisive++;
            }
            if (resultat.sures.length === 0 && resultat.mines.length === 0) break;

            for (const index of resultat.mines) {
                if (!verite[index]) bilan.fautes++;
                vue[index] = MINE;
            }
            for (const index of resultat.sures) {
                if (verite[index]) bilan.fautes++;
                ouvrir(index);
            }
        }
    }
    return bilan;
}

const bilan = partiesAuHasard({ colonnes: 16, lignes: 16, nbMines: 40, tirages: 60, graine: 2024 });
check('l\'enumeration tranche des situations que la logique locale laisse ouvertes',
    bilan.enumerationDecisive > 0, bilan);
check('aucune deduction fausse sur les grilles moyennes', bilan.fautes === 0, bilan);

const bilanExpert = partiesAuHasard({ colonnes: 30, lignes: 16, nbMines: 99, tirages: 40, graine: 77 });
check('aucune deduction fausse sur les grilles expertes', bilanExpert.fautes === 0, bilanExpert);

// ----------------------------------------------------------- resolution

const facile = creerPlateau({ colonnes: 9, lignes: 9 });
const grille = grilleManuelle(facile, [0, 1, 2, 9, 10, 11], calculerChiffres);
const resolution = resoudre({ plateau: facile, chiffres: grille.chiffres, mines: grille.mines, depart: 80 });
check('une grille sans piege se termine par la seule logique', resolution.resolu, resolution.bloquantes);
check('la resolution n\'ouvre jamais une mine',
    grille.mines.every((minee, index) => !minee || resolution.etat[index] !== REVELE));

// Un coup de des volontaire : une case revelee annonce « une mine » et trois
// candidates indiscernables l'entourent. Aucun etage ne peut trancher, et c'est
// exactement ce que le generateur doit savoir detecter pour rejeter la grille.
const piege = creerPlateau({ colonnes: 2, lignes: 2 });
const grillePiege = grilleManuelle(piege, [3], calculerChiffres);
const bloque = resoudre({ plateau: piege, chiffres: grillePiege.chiffres, mines: grillePiege.mines, depart: 0 });
check('un vrai coup de des est signale comme tel',
    bloque.resolu === false && bloque.bloquantes.length > 0, bloque);

report();
