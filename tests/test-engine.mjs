import * as jeu from '../js/engine.js';
import { deduire, INCONNU, REVELE, MINE } from '../js/solver.js';
import { counter, alea } from './harness.mjs';

const { check, report } = counter();
console.log('\nRegles du jeu\n');

let horloge = 0;
const partieDe = (options = {}) => jeu.nouvellePartie({
    colonnes: 9, lignes: 9, mines: 10,
    aleatoire: alea(99), maintenant: () => horloge,
    ...options
});

check('le plafond de mines laisse la zone du premier clic libre',
    jeu.minesMaximales(9, 9) === 72 && jeu.minesMaximales(3, 3) === 1);

// ------------------------------------------------------------- premier clic

horloge = 1000;
let partie = partieDe();
check('la grille n\'existe pas avant le premier clic', partie.statut === jeu.ATTENTE);
check('le compteur annonce toutes les mines', jeu.minesRestantes(partie) === 10);
check('le chrono ne tourne pas encore', jeu.tempsEcoule(partie) === 0);

const premier = jeu.reveler(partie, 40);
check('le premier clic lance la partie', partie.statut === jeu.ENCOURS);
check('le premier clic ouvre plusieurs cases', premier.revelees.length > 1, premier.revelees.length);
check('le premier clic n\'explose jamais', premier.explosions.length === 0);
check('les cases proches s\'ouvrent avant les lointaines',
    premier.revelees[0].vague === 0 && premier.revelees.at(-1).vague > 0);

horloge = 4500;
check('le chrono part du premier clic', jeu.tempsEcoule(partie) === 3500);

// ---------------------------------------------------------------- drapeaux

const fermee = [...Array(81).keys()].find(index => partie.etat[index] === jeu.CACHEE);
jeu.basculerDrapeau(partie, fermee);
check('poser un drapeau decompte le compteur', jeu.minesRestantes(partie) === 9);
check('une case marquee ne s\'ouvre pas', jeu.reveler(partie, fermee).refuse);

jeu.basculerDrapeau(partie, fermee);
check('sans la marque « ? », un second appui retire le drapeau',
    partie.etat[fermee] === jeu.CACHEE && jeu.minesRestantes(partie) === 10);

jeu.basculerDrapeau(partie, fermee, { doutes: true });
jeu.basculerDrapeau(partie, fermee, { doutes: true });
check('avec la marque « ? », le drapeau passe par le doute', partie.etat[fermee] === jeu.DOUTE);
check('un « ? » ne bloque pas l\'ouverture', jeu.reveler(partie, fermee).refuse === false);

// ------------------------------------------------------------------ accord

horloge = 0;
partie = partieDe({ colonnes: 5, lignes: 5, mines: 3, aleatoire: alea(7) });
jeu.reveler(partie, 12);

// On pose les drapeaux justes autour d'un chiffre, puis on l'appuie.
// Il faut un chiffre dont l'entourage ferme contient au moins une case saine :
// s'il n'y a que des mines a marquer, l'accord n'a plus rien a ouvrir.
const chiffreOuvert = [...Array(25).keys()].find(index =>
    partie.etat[index] === jeu.REVELEE && partie.chiffres[index] > 0 &&
    [...partie.plateau.voisins[index]].some(voisin =>
        partie.etat[voisin] === jeu.CACHEE && !partie.mines[voisin]));

if (chiffreOuvert !== undefined) {
    for (const voisin of partie.plateau.voisins[chiffreOuvert]) {
        if (partie.mines[voisin] && partie.etat[voisin] === jeu.CACHEE) jeu.basculerDrapeau(partie, voisin);
    }
    const avant = partie.revelees;
    const resultat = jeu.accord(partie, chiffreOuvert);
    check('l\'accord ouvre les voisines d\'un chiffre satisfait',
        partie.revelees > avant && resultat.explosions.length === 0);
} else {
    check('l\'accord ouvre les voisines d\'un chiffre satisfait', false, 'aucun chiffre exploitable');
}

// L'accord ne se declenche que sur un chiffre ouvert et satisfait : ni sur une
// case fermee, ni sur un zero, ni tant qu'il manque des drapeaux.
const neuve = partieDe({ aleatoire: alea(31) });
jeu.reveler(neuve, 30);
const indexTel = predicat => [...Array(81).keys()].find(predicat);

check('l\'accord ne part pas d\'une case fermee',
    jeu.accord(neuve, indexTel(index => neuve.etat[index] === jeu.CACHEE)).refuse);
check('l\'accord ne part pas d\'un zero',
    jeu.accord(neuve, indexTel(index =>
        neuve.etat[index] === jeu.REVELEE && neuve.chiffres[index] === 0)).refuse);
check('l\'accord attend que les drapeaux soient poses',
    jeu.accord(neuve, indexTel(index =>
        neuve.etat[index] === jeu.REVELEE && neuve.chiffres[index] > 0)).refuse);

// -------------------------------------------------------------------- vies

horloge = 0;
partie = partieDe({ colonnes: 8, lignes: 8, mines: 12, vies: 3, aleatoire: alea(21) });
jeu.reveler(partie, 27);

const premiereMine = [...Array(64).keys()].find(index => partie.mines[index] && partie.etat[index] === jeu.CACHEE);
const surMine = jeu.reveler(partie, premiereMine);
check('sauter sur une mine coute une vie', partie.viesRestantes === 2, partie.viesRestantes);
check('la partie continue tant qu\'il reste un coeur', partie.statut === jeu.ENCOURS);
check('la mine sautee reste visible', partie.explosee[premiereMine] === 1 && surMine.explosions.length === 1);
check('une mine neutralisee ne peut pas exploser deux fois',
    jeu.reveler(partie, premiereMine).refuse);
check('une mine sautee compte comme identifiee', jeu.minesRestantes(partie) === 11);

const autresMines = [...Array(64).keys()].filter(index => partie.mines[index] && partie.etat[index] === jeu.CACHEE);
jeu.reveler(partie, autresMines[0]);
jeu.reveler(partie, autresMines[1]);
check('la partie s\'arrete quand le dernier coeur tombe',
    partie.statut === jeu.PERDU && partie.viesRestantes === 0);
check('la defaite decouvre les mines restantes',
    autresMines.slice(2).every(index => partie.etat[index] === jeu.REVELEE));
check('a la defaite, le compteur cesse de decompter les mines sautees',
    jeu.minesRestantes(partie) === 12);
check('plus rien ne repond une fois la partie finie',
    jeu.reveler(partie, 0).refuse && jeu.basculerDrapeau(partie, 0).refuse);

// ----------------------------------------------------------------- victoire

horloge = 0;
partie = partieDe({ colonnes: 9, lignes: 9, mines: 10, aleatoire: alea(5) });
jeu.reveler(partie, 40);

// On joue la partie par la seule logique : une grille sans hasard doit tomber.
for (let tour = 0; tour < 200 && partie.statut === jeu.ENCOURS; tour++) {
    const vue = new Uint8Array(partie.plateau.taille);
    for (let index = 0; index < partie.plateau.taille; index++) {
        if (partie.etat[index] === jeu.REVELEE) vue[index] = REVELE;
        else if (partie.etat[index] === jeu.DRAPEAU) vue[index] = MINE;
        else vue[index] = INCONNU;
    }
    const { sures, mines } = deduire({
        plateau: partie.plateau, chiffres: partie.chiffres, etat: vue, minesTotales: partie.config.mines
    });
    if (sures.length === 0 && mines.length === 0) break;
    for (const index of mines) jeu.basculerDrapeau(partie, index);
    for (const index of sures) jeu.reveler(partie, index);
}

check('une grille sans hasard se gagne par la seule logique', partie.statut === jeu.GAGNE);
check('la victoire marque les dernieres mines', jeu.minesRestantes(partie) === 0);
check('toutes les cases sans mine sont ouvertes',
    partie.revelees === partie.plateau.taille - partie.config.mines);

horloge = 9999;
const fige = jeu.tempsEcoule(partie);
horloge = 20000;
check('le chrono s\'arrete a la fin de la partie', jeu.tempsEcoule(partie) === fige);

report();
