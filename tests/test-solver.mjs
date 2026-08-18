import { creerPlateau, calculerChiffres } from '../js/board.js';
import { deduire, resoudre, INCONNU, REVELE, MINE } from '../js/solver.js';
import { composerChiffres } from '../js/variantes.js';
import { counter, alea, grilleManuelle } from './harness.mjs';

const { check, report } = counter();
console.log('\nSolveur\n');

const exactes = chiffres => Array.from(chiffres, valeur => [valeur]);

// ------------------------------------------------------- deductions simples

const plateau = creerPlateau({ colonnes: 4, lignes: 4 });
const { chiffres } = grilleManuelle(plateau, [0], calculerChiffres);

// Case 1 revelee, chiffre 1, seule inconnue voisine : la case 0.
const etat = new Uint8Array(plateau.taille);
for (const index of [1, 2, 3, 4, 5, 6, 7]) etat[index] = REVELE;

let trouve = deduire({ plateau, sommes: exactes(chiffres), etat, minesTotales: 1 }, 1);
check('la regle triviale designe la mine', trouve.mines.includes(0), trouve);

const vide = new Uint8Array(plateau.taille);
vide[10] = REVELE;
trouve = deduire({
    plateau, sommes: exactes(calculerChiffres(plateau, new Uint8Array(16))), etat: vide, minesTotales: 0
}, 1);
check('un zero n\'apprend rien de plus qu\'une nappe deja ouverte',
    trouve.sures.length === 0 && trouve.mines.length === 0);

// Une case revelee qui garde des voisines fermees ne peut pas valoir zero :
// un zero aurait ouvert sa nappe. C'est ce qui rend les chiffres menteurs
// jouables — un « 1 » affiche vaut 0 ou 2, et 0 est ecarte d'office.
const menteuse = new Uint8Array(plateau.taille);
menteuse[5] = REVELE;
trouve = deduire({
    plateau,
    sommes: Array.from({ length: 16 }, (_, index) => (index === 5 ? [0, 2] : [0])),
    etat: menteuse,
    minesTotales: 2
}, 1);
check('un total de zero est ecarte quand des voisines restent fermees',
    trouve.sures.length === 0 && trouve.mines.length === 0, trouve);

// ------------------------------------------- l'etage 3 sert-il vraiment ?

// On rejoue des grilles au hasard ; a chaque blocage des deux premiers etages,
// on regarde ce que l'enumeration ajoute — et on verifie qu'elle ne se trompe
// jamais, en confrontant ses conclusions aux vraies mines.
function partiesAuHasard({ colonnes, lignes, nbMines, tirages, graine, mode = 'exacts' }) {
    const hasard = alea(graine);
    const bilan = { enumerationDecisive: 0, fautes: 0 };
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
        const { sommes } = composerChiffres({
            plateau: plateauLocal, chiffres: chiffresLocaux, mode, aleatoire: hasard
        });

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
            const contexte = { plateau: plateauLocal, sommes, etat: vue, minesTotales: nbMines };
            const local = deduire(contexte, 2);
            let resultat = local;

            if (local.sures.length === 0 && local.mines.length === 0) {
                resultat = deduire(contexte, 3);
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

const bilanExpert = partiesAuHasard({ colonnes: 30, lignes: 16, nbMines: 99, tirages: 30, graine: 77 });
check('aucune deduction fausse sur les grilles expertes', bilanExpert.fautes === 0, bilanExpert);

// La justesse ne doit rien devoir a la sincerite des chiffres : c'est tout
// l'interet d'avoir un solveur qui raisonne sur des ensembles de totaux.
for (const mode of ['menteurs', 'flous']) {
    const bilanVariante = partiesAuHasard({
        colonnes: 16, lignes: 16, nbMines: 40, tirages: 40, graine: 314, mode
    });
    check(`aucune deduction fausse avec des chiffres ${mode}`, bilanVariante.fautes === 0, bilanVariante);
}

// ----------------------------------------------------------- resolution

const facile = creerPlateau({ colonnes: 9, lignes: 9 });
const grille = grilleManuelle(facile, [0, 1, 2, 9, 10, 11], calculerChiffres);
const resolution = resoudre({
    plateau: facile, chiffres: grille.chiffres, sommes: exactes(grille.chiffres),
    mines: grille.mines, depart: 80
});
check('une grille sans piege se termine par la seule logique', resolution.resolu, resolution.bloquantes);
check('la resolution n\'ouvre jamais une mine',
    grille.mines.every((minee, index) => !minee || resolution.etat[index] !== REVELE));

// Un coup de des volontaire : une case revelee annonce « une mine » et trois
// candidates indiscernables l'entourent. Aucun etage ne peut trancher, et c'est
// exactement ce que le generateur doit savoir detecter pour rejeter la grille.
const piege = creerPlateau({ colonnes: 2, lignes: 2 });
const grillePiege = grilleManuelle(piege, [3], calculerChiffres);
const bloque = resoudre({
    plateau: piege, chiffres: grillePiege.chiffres, sommes: exactes(grillePiege.chiffres),
    mines: grillePiege.mines, depart: 0
});
check('un vrai coup de des est signale comme tel',
    bloque.resolu === false && bloque.bloquantes.length > 0, bloque);

// Reprise en cours de partie : ce dont l'autopsie a besoin. L'etat fourni doit
// etre un etat de jeu credible — une case a zero y a forcement ses voisines
// ouvertes — sinon on demande au solveur de raisonner sur une grille que le
// moteur n'aurait jamais produite.
function etatApresPremierClic(plateau, chiffresVrais, depart) {
    const vue = new Uint8Array(plateau.taille);
    const pile = [depart];
    while (pile.length > 0) {
        const index = pile.pop();
        if (vue[index] === REVELE) continue;
        vue[index] = REVELE;
        if (chiffresVrais[index] === 0) {
            for (const voisin of plateau.voisins[index]) if (vue[voisin] !== REVELE) pile.push(voisin);
        }
    }
    return vue;
}

const reprise = resoudre({
    plateau: facile, chiffres: grille.chiffres, sommes: exactes(grille.chiffres),
    mines: grille.mines, etatInitial: etatApresPremierClic(facile, grille.chiffres, 80)
});
check('la resolution sait reprendre depuis un etat donne', reprise.resolu, reprise.bloquantes.length);

report();
