// Assemblage : cree la partie, branche la grille aux gestes, tient les
// compteurs a jour et decide quand la partie s'arrete.

import * as jeu from './engine.js';
import { creerRendu } from './render.js';
import { brancherEntrees } from './input.js';
import * as ui from './ui.js';
import {
    chargerPreferences, enregistrerPreferences,
    cleDeClassement, enregistrerRecord, enregistrerPartie, effacerStats
} from './storage.js';

const preferences = chargerPreferences();
const rendu = creerRendu(ui.elements.canvas);

let partie = null;
let rafraichissementDemande = false;
let minuterieChrono = null;

// ------------------------------------------------------------------- rendu

function dessiner() {
    rafraichissementDemande = false;
    const encore = rendu.dessiner(performance.now());
    if (encore) demanderRendu();
}

function demanderRendu() {
    if (rafraichissementDemande) return;
    rafraichissementDemande = true;
    requestAnimationFrame(dessiner);
}

function majCompteurs() {
    ui.majCompteurs({ mines: jeu.minesRestantes(partie), temps: jeu.tempsEcoule(partie) });
}

// L'intervalle tourne des la mise en place, avant meme le premier clic : la
// partie ne passe a « en cours » qu'au moment ou la grille est tiree, et guetter
// cet instant depuis ici serait une source d'oubli.
function reglerChrono() {
    clearInterval(minuterieChrono);
    if (partie.statut === jeu.GAGNE || partie.statut === jeu.PERDU) return;
    minuterieChrono = setInterval(majCompteurs, 200);
}

// ------------------------------------------------------------------ partie

function nouvellePartie() {
    const { colonnes, lignes, mines, sansHasard, vies } = preferences;
    partie = jeu.nouvellePartie({ colonnes, lignes, mines, sansHasard, vies });

    rendu.attacher(partie);
    ui.majVisage('🙂');
    ui.majVies(partie.viesRestantes, vies);
    majCompteurs();
    reglerChrono();
    demanderRendu();
}

function vibrer(motif) {
    if (preferences.vibration) navigator.vibrate?.(motif);
}

// Une seule porte de sortie pour les trois issues possibles d'un geste : ca
// evite d'oublier le chrono ou les stats sur l'un des chemins.
function appliquer(resultat) {
    if (resultat.refuse) return;

    if (resultat.revelees?.length) rendu.animerRevelation(resultat.revelees);
    for (const index of resultat.explosions ?? []) {
        rendu.animerExplosion(index);
        vibrer([30, 40, 60]);
    }

    ui.majVies(partie.viesRestantes, partie.config.vies);
    majCompteurs();
    demanderRendu();

    if (partie.statut === jeu.GAGNE || partie.statut === jeu.PERDU) terminer();
    else if (resultat.explosions?.length) {
        ui.annoncer(`Mine ! ${partie.viesRestantes} cœur${partie.viesRestantes > 1 ? 's' : ''} restant${partie.viesRestantes > 1 ? 's' : ''}`);
    }
}

function terminer() {
    clearInterval(minuterieChrono);
    majCompteurs();

    const gagne = partie.statut === jeu.GAGNE;
    ui.majVisage(gagne ? '😎' : '😵');
    enregistrerPartie(gagne);

    const temps = jeu.tempsEcoule(partie);
    let record;
    if (gagne) {
        const cle = cleDeClassement({ ...preferences, ...partie.config });
        const bilan = enregistrerRecord(cle, temps);
        if (bilan.record) record = bilan.ancien;
    }
    vibrer(gagne ? [40, 60, 40] : 120);

    setTimeout(() => ui.ouvrirFin({
        gagne,
        temps,
        record: gagne ? record : undefined,
        garanti: partie.garanti,
        vies: partie.viesRestantes,
        viesTotales: partie.config.vies
    }), gagne ? 500 : 900);
}

// ------------------------------------------------------------------ gestes

brancherEntrees(ui.elements.canvas, rendu, {
    modeDrapeau: () => preferences.modeDrapeau,
    rafraichir: demanderRendu,
    reveler: index => appliquer(jeu.reveler(partie, index)),
    accord: index => appliquer(jeu.accord(partie, index)),
    drapeau: index => {
        const resultat = jeu.basculerDrapeau(partie, index, { doutes: preferences.doutes });
        if (!resultat.refuse) vibrer(12);
        appliquer(resultat);
    }
});

// ---------------------------------------------------------------- interface

ui.elements.visage.addEventListener('click', nouvellePartie);

ui.elements.bascule.addEventListener('click', () => {
    preferences.modeDrapeau = !preferences.modeDrapeau;
    enregistrerPreferences(preferences);
    ui.majBascule(preferences.modeDrapeau);
});

document.getElementById('bouton-aide').addEventListener('click', () => ui.elements.dialogueAide.showModal());
document.getElementById('bouton-reglages').addEventListener('click', ouvrirReglages);
document.getElementById('fin-reglages').addEventListener('click', () => {
    ui.elements.dialogueFin.close();
    ouvrirReglages();
});
document.getElementById('fin-rejouer').addEventListener('click', () => {
    ui.elements.dialogueFin.close();
    nouvellePartie();
});

for (const bouton of document.querySelectorAll('[data-fermer]')) {
    bouton.addEventListener('click', () => bouton.closest('dialog').close());
}

// ---------------------------------------------------------------- reglages

let configurationALOuverture = null;

const configurationCourante = () => JSON.stringify([
    preferences.colonnes, preferences.lignes, preferences.mines,
    preferences.sansHasard, preferences.vies
]);

function ouvrirReglages() {
    ui.refletDesReglages(preferences);
    configurationALOuverture = configurationCourante();
    ui.elements.dialogueReglages.showModal();
}

// Changer de difficulte relance forcement la grille ; on ne le fait qu'a la
// fermeture, pour ne pas jeter la partie en cours des le premier clic dans le
// panneau.
ui.elements.dialogueReglages.addEventListener('close', () => {
    enregistrerPreferences(preferences);
    if (configurationCourante() !== configurationALOuverture) nouvellePartie();
});

for (const bouton of document.querySelectorAll('#segments-difficulte .segment')) {
    bouton.addEventListener('click', () => {
        const choix = bouton.dataset.difficulte;
        preferences.difficulte = choix;
        if (choix !== 'perso') {
            const { colonnes, lignes, mines } = jeu.DIFFICULTES[choix];
            Object.assign(preferences, { colonnes, lignes, mines });
        }
        ui.refletDesReglages(preferences);
    });
}

const champs = {
    'champ-colonnes': 'colonnes',
    'champ-lignes': 'lignes',
    'champ-mines': 'mines'
};

for (const [identifiant, clef] of Object.entries(champs)) {
    document.getElementById(identifiant).addEventListener('change', evenement => {
        const champ = evenement.target;
        const valeur = Number.parseInt(champ.value, 10);
        const minimum = Number(champ.min);
        const maximum = Number(champ.max) || Infinity;

        preferences[clef] = Number.isNaN(valeur)
            ? preferences[clef]
            : Math.max(minimum, Math.min(maximum, valeur));

        // Retailler la grille peut rendre le nombre de mines intenable.
        preferences.mines = Math.min(preferences.mines,
            jeu.minesMaximales(preferences.colonnes, preferences.lignes));
        ui.refletDesReglages(preferences);
    });
}

const interrupteurs = {
    'option-sans-hasard': valeur => { preferences.sansHasard = valeur; },
    'option-vies': valeur => { preferences.vies = valeur ? 3 : 1; },
    'option-doutes': valeur => { preferences.doutes = valeur; },
    'option-vibration': valeur => { preferences.vibration = valeur; }
};

for (const [identifiant, appliquerOption] of Object.entries(interrupteurs)) {
    document.getElementById(identifiant).addEventListener('change', evenement => {
        appliquerOption(evenement.target.checked);
        ui.refletDesReglages(preferences);
    });
}

document.getElementById('effacer-records').addEventListener('click', () => {
    effacerStats();
    ui.majRecords();
});

// ------------------------------------------------------------------ demarrage

const observateur = new ResizeObserver(() => {
    rendu.redimensionner();
    rendu.ajusterVue();
    demanderRendu();
});
observateur.observe(ui.elements.canvas);

window.addEventListener('keydown', evenement => {
    if (evenement.key === 'r' || evenement.key === 'R') {
        if (!document.querySelector('dialog[open]')) nouvellePartie();
    }
});

rendu.redimensionner();
ui.majBascule(preferences.modeDrapeau);
nouvellePartie();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
