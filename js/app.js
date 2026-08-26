// Assemblage : cree la partie, branche la grille aux gestes, tient les
// compteurs a jour et decide quand la partie s'arrete.

import * as jeu from './engine.js';
import { creerRendu } from './render.js';
import { brancherEntrees } from './input.js';
import * as ui from './ui.js';
import { normaliser } from './variantes.js';
import { defiDuJour, texteDePartage } from './defi.js';
import { generateurAleatoire } from './hasard.js';
import { themeSuivant, libelleDuTheme } from './themes.js';
import {
    sonAccord, sonExplosion, sonVictoire, sonDefaite, sonIndice,
    preparerSon, surveillerVisibilite
} from './son.js';
import {
    chargerPreferences, enregistrerPreferences,
    cleDeClassement, enregistrerRecord, enregistrerPartie, effacerStats
} from './storage.js';

const preferences = chargerPreferences();
const rendu = creerRendu(ui.elements.canvas);

let partie = null;
let defi = null;                    // grille du jour en cours, sinon null
let rafraichissementDemande = false;
let minuterieChrono = null;
let glissementExplique = false;

// ------------------------------------------------------------------- rendu

function dessiner() {
    rafraichissementDemande = false;
    if (rendu.dessiner(performance.now())) demanderRendu();
}

function demanderRendu() {
    if (rafraichissementDemande) return;
    rafraichissementDemande = true;
    requestAnimationFrame(dessiner);
}

function majCompteurs() {
    ui.majCompteurs({
        mines: jeu.minesRestantes(partie),
        temps: jeu.tempsEcoule(partie),
        restant: jeu.tempsRestant(partie)
    });
}

// Le sablier du blitz est la seule fin de partie que personne ne declenche :
// c'est le chrono qui doit la constater.
function battement() {
    if (jeu.verifierTemps(partie)) {
        majCompteurs();
        terminer();
        return;
    }
    majCompteurs();
}

function reglerChrono() {
    clearInterval(minuterieChrono);
    if (partie.statut === jeu.GAGNE || partie.statut === jeu.PERDU) return;
    minuterieChrono = setInterval(battement, 200);
}

// ------------------------------------------------------------------ partie

const configurationDeJeu = () => normaliser({
    difficulte: preferences.difficulte,
    colonnes: preferences.colonnes,
    lignes: preferences.lignes,
    mines: preferences.mines,
    topologie: preferences.topologie,
    enroule: preferences.enroule,
    chiffres: preferences.chiffres,
    rythme: preferences.rythme,
    sansHasard: preferences.sansHasard
});

function nouvellePartie() {
    const config = defi ? defi.config : configurationDeJeu();

    partie = jeu.nouvellePartie({
        ...config,
        // Le defi du jour doit tomber sur la meme grille pour tout le monde :
        // c'est la date qui tient le des, pas Math.random.
        aleatoire: defi ? generateurAleatoire(defi.graine) : Math.random
    });

    rendu.attacher(partie);
    ui.majVisage('🙂');
    ui.majVies(partie.viesRestantes, partie.config.vies);
    ui.majBandeau({ config, defi });
    ui.elements.indice.disabled = false;
    majCompteurs();
    reglerChrono();
    demanderRendu();

    // Une grille plus large que l'ecran se deplace au doigt, mais rien ne le
    // dit : sans ce mot, on croit la grille tronquee.
    if (!glissementExplique && rendu.deborde()) {
        glissementExplique = true;
        ui.annoncer('La grille dépasse : faites-la glisser pour vous déplacer', 3600);
    }
}

const vibrer = motif => { if (preferences.vibration) navigator.vibrate?.(motif); };
const sonner = (timbre, ...arguments_) => { if (preferences.sons) timbre(...arguments_); };

// Une seule porte de sortie pour les issues possibles d'un geste : ca evite
// d'oublier le chrono ou les stats sur l'un des chemins.
function appliquer(resultat) {
    if (resultat.refuse) return;

    if (resultat.revelees?.length) rendu.animerRevelation(resultat.revelees);
    for (const index of resultat.explosions ?? []) {
        rendu.animerExplosion(index);
        vibrer([30, 40, 60]);
    }
    // Un accord peut faire sauter plusieurs mines d'un coup : une detonation
    // par mine ferait une bouillie, on n'en joue qu'une pour le geste.
    if (resultat.explosions?.length) sonner(sonExplosion, { fatale: partie.statut === jeu.PERDU });
    if (resultat.revelees?.length || resultat.explosions?.length) rendu.soulignees.clear();

    ui.majVies(partie.viesRestantes, partie.config.vies);
    majCompteurs();
    demanderRendu();

    if (partie.statut === jeu.GAGNE || partie.statut === jeu.PERDU) terminer();
    else if (resultat.explosions?.length) {
        const restantes = partie.viesRestantes;
        ui.annoncer(Number.isFinite(restantes)
            ? `Mine ! ${restantes} cœur${restantes > 1 ? 's' : ''} restant${restantes > 1 ? 's' : ''}`
            : 'Mine neutralisée');
    }
}

function terminer() {
    clearInterval(minuterieChrono);
    majCompteurs();
    ui.elements.indice.disabled = true;

    const gagne = partie.statut === jeu.GAGNE;
    ui.majVisage(gagne ? '😎' : '😵');
    enregistrerPartie(gagne);
    sonner(gagne ? sonVictoire : sonDefaite);

    const tempsEcoule = jeu.tempsEcoule(partie);
    let record;
    // Un temps obtenu a coups d'indices n'a rien a faire dans un palmares, et
    // la grille du jour a son propre affichage.
    if (gagne && !defi && partie.indices === 0) {
        const bilan = enregistrerRecord(cleDeClassement({ ...preferences, ...partie.config }), tempsEcoule);
        if (bilan.record) record = bilan.ancien;
    }
    vibrer(gagne ? [40, 60, 40] : 120);

    setTimeout(() => ui.ouvrirFin({
        gagne,
        tempsEcoule,
        record,
        garanti: partie.garanti,
        vies: partie.viesRestantes,
        viesTotales: partie.config.vies,
        autopsie: partie.autopsie,
        expire: Boolean(partie.rebours) && jeu.tempsRestant(partie) <= 0,
        defi
    }), gagne ? 500 : 900);
}

// ------------------------------------------------------------------ gestes

brancherEntrees(ui.elements.canvas, rendu, {
    modeDrapeau: () => preferences.modeDrapeau,
    rafraichir: demanderRendu,
    reveler: index => appliquer(jeu.reveler(partie, index)),
    accord: index => {
        const resultat = jeu.accord(partie, index);
        // La recompense va a la deduction juste : si l'accord fait sauter une
        // mine, c'est la detonation qui parle, pas l'accord.
        if (!resultat.refuse && !resultat.explosions.length) sonner(sonAccord);
        appliquer(resultat);
    },
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

ui.elements.indice.addEventListener('click', () => {
    const conseil = jeu.indice(partie);
    if (!conseil) {
        ui.annoncer(partie.statut === jeu.ATTENTE
            ? 'Ouvrez d\'abord une case'
            : 'Rien de certain à cet instant');
        return;
    }
    sonner(sonIndice);
    rendu.soulignees.clear();
    rendu.soulignees.add(conseil.index);
    ui.annoncer(conseil.genre === 'sure'
        ? 'Cette case est sûre — 15 secondes de pénalité'
        : 'Une mine ici — 15 secondes de pénalité');
    majCompteurs();
    demanderRendu();
});

function choisirTheme(theme, { annoncer = false } = {}) {
    preferences.theme = ui.appliquerTheme(theme);
    enregistrerPreferences(preferences);
    // La grille garde sa propre copie des couleurs, le temps d'une image.
    rendu.relirePalette();
    demanderRendu();
    if (annoncer) ui.annoncer(`Thème ${libelleDuTheme(preferences.theme).toLowerCase()}`, 1600);
}

// Le bouton fait tourner la liste ; les reglages donnent l'acces direct.
ui.elements.boutonTheme.addEventListener('click', () => {
    choisirTheme(themeSuivant(preferences.theme), { annoncer: true });
});

ui.elements.boutonDefi.addEventListener('click', () => {
    defi = defi ? null : defiDuJour();
    nouvellePartie();
    if (defi) ui.annoncer(`Grille du jour : ${defi.resume}`, 3200);
});

ui.elements.finPartager.addEventListener('click', async () => {
    const texte = texteDePartage({
        cle: defi.cle,
        resume: defi.resume,
        gagne: partie.statut === jeu.GAGNE,
        temps: jeu.tempsEcoule(partie),
        avancement: partie.revelees / (partie.plateau.taille - partie.config.mines),
        indices: partie.indices,
        lien: location.href.split('?')[0]
    });

    // Sur telephone, la feuille de partage native est ce qu'on attend ; la
    // refermer sans partager est un choix, pas une panne, donc on se tait.
    if (navigator.share) {
        try { await navigator.share({ text: texte }); } catch { /* annule */ }
        return;
    }

    // Ailleurs, le presse-papier fait le meme travail — mais s'il refuse, il
    // faut le dire : sinon le bouton semble ne rien faire.
    try {
        await navigator.clipboard.writeText(texte);
        ui.annoncer('Résultat copié');
    } catch {
        ui.annoncer('Copie refusée par le navigateur');
    }
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

const empreinteDeConfiguration = () => JSON.stringify(configurationDeJeu());

function ouvrirReglages() {
    ui.refletDesReglages(preferences);
    configurationALOuverture = empreinteDeConfiguration();
    ui.elements.dialogueReglages.showModal();
}

// Changer un reglage relance forcement la grille ; on ne le fait qu'a la
// fermeture, pour ne pas jeter la partie en cours des le premier clic dans le
// panneau. Toucher aux reglages sort aussi du defi du jour : celui-ci impose sa
// propre recette, la modifier n'aurait aucun sens.
ui.elements.dialogueReglages.addEventListener('close', () => {
    enregistrerPreferences(preferences);
    if (empreinteDeConfiguration() === configurationALOuverture) return;
    defi = null;
    nouvellePartie();
});

const segments = {
    'segments-difficulte': (bouton) => {
        const choix = bouton.dataset.difficulte;
        preferences.difficulte = choix;
        if (choix !== 'perso') {
            const { colonnes, lignes, mines } = jeu.DIFFICULTES[choix];
            Object.assign(preferences, { colonnes, lignes, mines });
        }
    },
    'segments-plateau': bouton => { preferences.topologie = bouton.dataset.topologie; },
    'segments-chiffres': bouton => { preferences.chiffres = bouton.dataset.chiffres; },
    'segments-rythme': bouton => { preferences.rythme = bouton.dataset.rythme; },
    // Le theme ne fait pas partie de la recette d'une partie : on l'applique
    // aussitot, sans attendre la fermeture du panneau ni relancer la grille.
    'segments-theme': bouton => choisirTheme(bouton.dataset.themeChoisi)
};

for (const [conteneur, appliquerChoix] of Object.entries(segments)) {
    for (const bouton of document.querySelectorAll(`#${conteneur} .segment`)) {
        bouton.addEventListener('click', () => {
            appliquerChoix(bouton);
            Object.assign(preferences, normaliser(preferences));
            ui.refletDesReglages(preferences);
        });
    }
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

        Object.assign(preferences, normaliser(preferences));
        ui.refletDesReglages(preferences);
    });
}

const interrupteurs = {
    'option-enroule': valeur => { preferences.enroule = valeur; },
    'option-sans-hasard': valeur => { preferences.sansHasard = valeur; },
    'option-doutes': valeur => { preferences.doutes = valeur; },
    // Rallumer le son sans rien entendre laisse dans le doute : la note de
    // l'indice sert d'accuse de reception.
    'option-sons': valeur => { preferences.sons = valeur; if (valeur) sonIndice(); },
    'option-vibration': valeur => { preferences.vibration = valeur; }
};

for (const [identifiant, appliquerOption] of Object.entries(interrupteurs)) {
    document.getElementById(identifiant).addEventListener('change', evenement => {
        appliquerOption(evenement.target.checked);
        Object.assign(preferences, normaliser(preferences));
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
    if (document.querySelector('dialog[open]')) return;
    if (evenement.key === 'r' || evenement.key === 'R') nouvellePartie();
    if (evenement.key === 'h' || evenement.key === 'H') ui.elements.indice.click();
    if (evenement.key === 't' || evenement.key === 'T') ui.elements.boutonTheme.click();
});

// iOS ne demarre un contexte audio que depuis un evenement d'activation, et le
// premier son du Demineur peut fort bien naitre d'un `setTimeout` (le drapeau
// par appui long) ou du chrono (le sablier du blitz) : on prepare le contexte
// des le premier geste, avant d'avoir une note a demander.
preparerSon(document, () => preferences.sons);
surveillerVisibilite(document);

rendu.redimensionner();
choisirTheme(preferences.theme);
ui.majBascule(preferences.modeDrapeau);
Object.assign(preferences, normaliser(preferences));
nouvellePartie();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
