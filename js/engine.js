// Regles du jeu : l'etat d'une partie et ce que chaque geste lui fait.
//
// Ce module ne connait ni le DOM ni le canvas. Il recoit des index de case et
// rend des evenements ; c'est le rendu qui decide comment les montrer.

import { creerPlateau } from './board.js';
import { genererGrille } from './generator.js';

export const CACHEE = 0;
export const REVELEE = 1;
export const DRAPEAU = 2;
export const DOUTE = 3;

export const ATTENTE = 'attente';   // grille pas encore tiree : le 1er clic la decide
export const ENCOURS = 'encours';
export const GAGNE = 'gagne';
export const PERDU = 'perdu';

export const DIFFICULTES = {
    facile: { colonnes: 9, lignes: 9, mines: 10, libelle: 'Facile' },
    moyen: { colonnes: 16, lignes: 16, mines: 40, libelle: 'Moyen' },
    expert: { colonnes: 30, lignes: 16, mines: 99, libelle: 'Expert' }
};

// Plafond de mines d'une grille : la zone du premier clic — une case et ses
// huit voisines — doit toujours pouvoir rester libre.
export const minesMaximales = (colonnes, lignes) => Math.max(1, colonnes * lignes - 9);

export function nouvellePartie({
    colonnes = 9,
    lignes = 9,
    mines = 10,
    vies = 1,
    sansHasard = true,
    enroule = false,
    aleatoire = Math.random,
    maintenant = () => Date.now()
} = {}) {
    const plateau = creerPlateau({ colonnes, lignes, enroule });
    return {
        plateau,
        config: { colonnes, lignes, mines, vies, sansHasard, enroule },
        aleatoire,
        maintenant,
        mines: new Uint8Array(plateau.taille),
        chiffres: new Uint8Array(plateau.taille),
        etat: new Uint8Array(plateau.taille),
        explosee: new Uint8Array(plateau.taille),
        statut: ATTENTE,
        viesRestantes: vies,
        garanti: sansHasard,
        revelees: 0,          // cases sans mine ouvertes
        drapeaux: 0,
        debutMs: null,
        finMs: null
    };
}

// Le compteur affiche : mines annoncees moins ce que le joueur a neutralise.
// Une mine qui lui a saute au visage compte comme identifiee — tant qu'il reste
// une vie. Sur la derniere, la partie est finie et decompter cette mine-la
// donnerait l'impression d'un bug juste avant le verdict.
export const minesRestantes = partie => {
    if (partie.statut === PERDU) return partie.config.mines - partie.drapeaux;

    let explosees = 0;
    for (let index = 0; index < partie.plateau.taille; index++) {
        if (partie.explosee[index]) explosees++;
    }
    return partie.config.mines - partie.drapeaux - explosees;
};

export const tempsEcoule = partie => {
    if (partie.debutMs === null) return 0;
    return (partie.finMs ?? partie.maintenant()) - partie.debutMs;
};

const estNeutralisee = (partie, index) =>
    partie.etat[index] === DRAPEAU || partie.explosee[index] === 1;

function terminer(partie, statut) {
    partie.statut = statut;
    partie.finMs = partie.maintenant();
    if (statut === PERDU) {
        // On decouvre les mines non trouvees, et on souligne les drapeaux poses
        // a cote de la plaque : c'est la que le joueur comprend son erreur.
        for (let index = 0; index < partie.plateau.taille; index++) {
            if (partie.mines[index] && partie.etat[index] !== DRAPEAU) partie.etat[index] = REVELEE;
        }
    }
    if (statut === GAGNE) {
        for (let index = 0; index < partie.plateau.taille; index++) {
            if (partie.mines[index] && partie.etat[index] === CACHEE) {
                partie.etat[index] = DRAPEAU;
                partie.drapeaux++;
            }
        }
    }
}

function verifierVictoire(partie) {
    const sansMine = partie.plateau.taille - partie.config.mines;
    if (partie.revelees === sansMine) terminer(partie, GAGNE);
}

// Ouverture en nappe : une case a 0 entraine ses voisines. `vague` est la
// distance depuis le point de depart, le rendu s'en sert pour derouler
// l'animation au lieu de tout afficher d'un bloc.
function ouvrir(partie, depart, revelees) {
    const file = [[depart, 0]];
    while (file.length > 0) {
        const [index, vague] = file.shift();
        if (partie.etat[index] !== CACHEE) continue;

        partie.etat[index] = REVELEE;
        partie.revelees++;
        revelees.push({ index, vague });

        if (partie.chiffres[index] === 0) {
            for (const voisin of partie.plateau.voisins[index]) {
                if (partie.etat[voisin] === CACHEE) file.push([voisin, vague + 1]);
            }
        }
    }
}

// Une mine sautee. Avec des vies restantes la partie continue, la mine reste
// visible et neutralisee : elle ne peut plus surprendre deux fois.
function declencher(partie, index, explosions) {
    partie.explosee[index] = 1;
    partie.etat[index] = REVELEE;
    explosions.push(index);
    partie.viesRestantes--;
    if (partie.viesRestantes <= 0) terminer(partie, PERDU);
}

function demarrerSiBesoin(partie, depart) {
    if (partie.statut !== ATTENTE) return;

    const { mines, chiffres, garanti } = genererGrille({
        plateau: partie.plateau,
        nbMines: partie.config.mines,
        depart,
        sansHasard: partie.config.sansHasard,
        aleatoire: partie.aleatoire
    });
    partie.mines = mines;
    partie.chiffres = chiffres;
    partie.garanti = garanti;
    partie.statut = ENCOURS;
    partie.debutMs = partie.maintenant();
}

const rienAFaire = { revelees: [], explosions: [], refuse: true };

export function reveler(partie, index) {
    if (partie.statut === GAGNE || partie.statut === PERDU) return rienAFaire;
    if (partie.etat[index] === DRAPEAU || partie.etat[index] === REVELEE) return rienAFaire;

    demarrerSiBesoin(partie, index);

    const revelees = [];
    const explosions = [];

    if (partie.mines[index]) declencher(partie, index, explosions);
    else {
        partie.etat[index] = CACHEE; // un « ? » ne bloque pas l'ouverture
        ouvrir(partie, index, revelees);
        verifierVictoire(partie);
    }
    return { revelees, explosions, refuse: false };
}

export function basculerDrapeau(partie, index, { doutes = false } = {}) {
    if (partie.statut === GAGNE || partie.statut === PERDU) return rienAFaire;
    if (partie.etat[index] === REVELEE) return rienAFaire;

    if (partie.etat[index] === CACHEE) {
        partie.etat[index] = DRAPEAU;
        partie.drapeaux++;
    } else if (partie.etat[index] === DRAPEAU) {
        // Le « ? » n'est utile qu'a ceux qui annotent : sinon il ajoute un
        // troisieme etat a traverser pour retirer un drapeau pose par erreur.
        partie.etat[index] = doutes ? DOUTE : CACHEE;
        partie.drapeaux--;
    } else {
        partie.etat[index] = CACHEE;
    }
    return { revelees: [], explosions: [], refuse: false, drapeau: index };
}

// Appui sur un chiffre deja satisfait : ouvre d'un coup tout ce qui l'entoure.
// C'est ce qui rend le jeu rapide ; sans lui on passe la partie a cliquer case
// par case. Si un drapeau est mal place, ca explose — c'est le risque assume.
export function accord(partie, index) {
    if (partie.statut !== ENCOURS) return rienAFaire;
    if (partie.etat[index] !== REVELEE || partie.chiffres[index] === 0) return rienAFaire;

    let neutralisees = 0;
    for (const voisin of partie.plateau.voisins[index]) {
        if (estNeutralisee(partie, voisin)) neutralisees++;
    }
    if (neutralisees !== partie.chiffres[index]) return rienAFaire;

    const revelees = [];
    const explosions = [];
    for (const voisin of partie.plateau.voisins[index]) {
        if (partie.etat[voisin] !== CACHEE) continue;
        if (partie.mines[voisin]) declencher(partie, voisin, explosions);
        else ouvrir(partie, voisin, revelees);
    }
    if (partie.statut === ENCOURS) verifierVictoire(partie);
    return { revelees, explosions, refuse: revelees.length === 0 && explosions.length === 0 };
}

// Les voisines encore fermees d'un chiffre : le rendu les enfonce pendant
// l'appui, seul retour visuel qui dit « l'accord va partir ».
export function voisinesOuvrables(partie, index) {
    if (partie.etat[index] !== REVELEE || partie.chiffres[index] === 0) return [];
    return [...partie.plateau.voisins[index]].filter(voisin => partie.etat[voisin] === CACHEE);
}
