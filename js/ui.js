// Tout ce qui touche au DOM autour de la grille : compteurs, bandeau,
// dialogues, reglages. La grille elle-meme est dessinee par render.js.

import { DIFFICULTES, minesMaximales } from './engine.js';
import { MODES_CHIFFRES, RYTHMES } from './variantes.js';
import { chargerRecords, chargerStats } from './storage.js';
import { resumeDe } from './defi.js';
import { THEMES, themeConnu, THEME_PAR_DEFAUT } from './themes.js';
import { VERSION } from './config.js';

const $ = identifiant => document.getElementById(identifiant);

export const elements = {
    canvas: $('grille'),
    bandeau: $('bandeau-recette'),
    valeurMines: $('valeur-mines'),
    compteurTemps: $('compteur-temps'),
    valeurTemps: $('valeur-temps'),
    vies: $('vies'),
    visage: $('bouton-rejouer'),
    annonce: $('annonce'),
    bascule: $('bascule-mode'),
    basculeTexte: document.querySelector('.bascule-texte'),
    indice: $('bouton-indice'),
    astuce: $('astuce'),
    boutonDefi: $('bouton-defi'),
    boutonTheme: $('bouton-theme'),
    dialogueFin: $('dialogue-fin'),
    finTitre: $('fin-titre'),
    finDetail: $('fin-detail'),
    finAutopsie: $('fin-autopsie'),
    finRecord: $('fin-record'),
    finPartager: $('fin-partager'),
    dialogueReglages: $('dialogue-reglages'),
    dialogueAide: $('dialogue-aide')
};

export function formaterTemps(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

// En blitz, le chrono compte a l'envers : c'est le meme afficheur, mais il
// prend une couleur d'alerte sur la fin de sablier.
export function majCompteurs({ mines, temps, restant }) {
    elements.valeurMines.textContent = String(mines);
    elements.valeurTemps.textContent = formaterTemps(restant ?? temps);
    elements.compteurTemps.classList.toggle('urgence', restant !== null && restant < 15000);
}

export function majVies(restantes, total) {
    if (total === 1) {
        elements.vies.hidden = true;
        return;
    }
    elements.vies.hidden = false;
    elements.vies.innerHTML = Number.isFinite(total)
        ? Array.from({ length: total }, (_, position) =>
            `<span class="${position < restantes ? '' : 'perdue'}">❤</span>`).join('')
        : '<span class="infini">∞</span>';
}

export const majVisage = tete => { elements.visage.textContent = tete; };

// Le selecteur des reglages est construit depuis la liste : ajouter un theme
// ne demande alors qu'une entree dans themes.js et sa palette dans le CSS.
function construireSegmentsDeTheme() {
    $('segments-theme').innerHTML = THEMES.map(({ id, libelle }) =>
        `<button type="button" class="segment" data-theme-choisi="${id}">`
        + `<span class="pastille" data-apercu="${id}" aria-hidden="true"></span>${libelle}</button>`
    ).join('');
}

construireSegmentsDeTheme();

// Le numero vient du code charge, pas du HTML : si un vieux service worker sert
// encore ses fichiers, c'est son numero qui s'affiche, et on le voit.
$('version').textContent = `Démineur ${VERSION}`;

// Applique le theme et accorde la barre du navigateur avec : sur telephone,
// une barre d'adresse restee sombre au-dessus d'une page claire se voit.
export function appliquerTheme(theme) {
    const retenu = themeConnu(theme) ? theme : THEME_PAR_DEFAUT;
    document.documentElement.dataset.theme = retenu;

    const fond = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    $('couleur-barre').setAttribute('content', fond);
    return retenu;
}

let minuterieAnnonce = null;

export function annoncer(texte, duree = 2600) {
    clearTimeout(minuterieAnnonce);
    elements.annonce.textContent = texte;
    elements.annonce.classList.add('visible');
    minuterieAnnonce = setTimeout(() => elements.annonce.classList.remove('visible'), duree);
}

export function majBascule(modeDrapeau) {
    elements.bascule.setAttribute('aria-pressed', String(modeDrapeau));
    elements.basculeTexte.textContent = modeDrapeau ? 'Drapeau' : 'Creuser';

    // Le geste inverse n'est pas le meme au doigt et a la souris : annoncer
    // l'appui long a quelqu'un qui a un clic droit sous la main est inutile.
    const auDoigt = window.matchMedia?.('(pointer: coarse)').matches;
    const inverse = modeDrapeau ? 'creuser' : 'drapeau';
    elements.astuce.textContent = `${auDoigt ? 'Appui long' : 'Clic droit'} : ${inverse}`;
}

// Le bandeau ne dit rien quand la partie est un demineur ordinaire : une ligne
// de texte permanente qui repete « carré, chiffres exacts » n'apprend rien.
export function majBandeau({ config, defi }) {
    const recette = resumeDe(config);
    const ordinaire = recette === (DIFFICULTES[config.difficulte]?.libelle ?? 'Perso');

    if (defi) elements.bandeau.innerHTML = `<strong>Grille du jour</strong> · ${recette}`;
    else elements.bandeau.textContent = ordinaire ? '' : recette;

    elements.boutonDefi.setAttribute('aria-pressed', String(Boolean(defi)));
}

// ------------------------------------------------------------------ records

const NOMS_TRAITS = {
    hexagone: 'hexagones', cavalier: 'cavalier', tore: 'bords recollés',
    menteurs: 'menteurs', flous: 'flous', sh: 'sans hasard', std: 'classique',
    vies: '3 vies', zen: 'zen', blitz: 'blitz'
};

function libelleClassement(cle) {
    const [format, ...traits] = cle.split('|');
    const nom = DIFFICULTES[format]?.libelle ?? format.replace('perso-', 'Perso ');
    return [nom, ...traits.map(trait => NOMS_TRAITS[trait] ?? trait)].join(' · ');
}

export function majRecords() {
    const stats = chargerStats();
    $('resume-stats').textContent = stats.jouees === 0
        ? 'Aucune partie jouée'
        : `${stats.jouees} partie${stats.jouees > 1 ? 's' : ''} · `
          + `${Math.round((stats.gagnees / stats.jouees) * 100)} % de victoires · `
          + `série de ${stats.serie} (record ${stats.meilleureSerie})`;

    const entrees = Object.entries(chargerRecords()).sort((a, b) => a[0].localeCompare(b[0]));
    $('liste-records').innerHTML = entrees.length === 0
        ? '<li class="vide">Aucun temps enregistré</li>'
        : entrees.map(([cle, temps]) =>
            `<li><span>${libelleClassement(cle)}</span><span>${formaterTemps(temps)}</span></li>`).join('');
}

// ----------------------------------------------------------------- reglages

const refletDesSegments = (conteneur, attribut, valeur) => {
    for (const bouton of document.querySelectorAll(`#${conteneur} .segment`)) {
        bouton.setAttribute('aria-pressed', String(bouton.dataset[attribut] === valeur));
    }
};

// Rend les champs coherents avec les preferences en cours et renvoie le nombre
// de mines maximal acceptable, dont l'appelant se sert pour brider la saisie.
export function refletDesReglages(preferences) {
    refletDesSegments('segments-difficulte', 'difficulte', preferences.difficulte);
    refletDesSegments('segments-plateau', 'topologie', preferences.topologie);
    refletDesSegments('segments-chiffres', 'chiffres', preferences.chiffres);
    refletDesSegments('segments-rythme', 'rythme', preferences.rythme);
    refletDesSegments('segments-theme', 'themeChoisi', preferences.theme);

    const perso = preferences.difficulte === 'perso';
    $('champs-perso').hidden = !perso;
    $('champ-colonnes').value = preferences.colonnes;
    $('champ-lignes').value = preferences.lignes;
    $('champ-mines').value = preferences.mines;

    const maximum = minesMaximales(preferences.colonnes, preferences.lignes);
    $('champ-mines').max = maximum;

    const densite = preferences.mines / (preferences.colonnes * preferences.lignes);
    $('perso-info').textContent = densite > 0.3 && preferences.sansHasard
        ? `Densité de ${Math.round(densite * 100)} % : la grille sans hasard peut mettre une seconde à se composer.`
        : `Jusqu'à ${maximum} mines.`;

    $('explication-chiffres').textContent = MODES_CHIFFRES[preferences.chiffres].resume;
    $('explication-rythme').textContent = RYTHMES[preferences.rythme].resume;
    $('explication-theme').textContent =
        THEMES.find(theme => theme.id === preferences.theme)?.resume ?? '';

    $('option-enroule').checked = preferences.enroule;
    $('option-sans-hasard').checked = preferences.sansHasard;
    $('option-doutes').checked = preferences.doutes;
    $('option-sons').checked = preferences.sons;
    $('option-vibration').checked = preferences.vibration;

    majRecords();
    return maximum;
}

// --------------------------------------------------------------- fin de partie

const AUTOPSIE = {
    evitable: ['Cette mine était identifiable : la logique la désignait déjà.', 'evitable'],
    ailleurs: ['Il restait des déductions à faire ailleurs sur la grille.', 'ailleurs'],
    inevitable: ['Aucune déduction ne pouvait vous sauver ici.', 'inevitable']
};

export function ouvrirFin({ gagne, tempsEcoule, record, garanti, vies, viesTotales, autopsie, defi, expire }) {
    elements.finTitre.textContent = gagne ? 'Grille déminée' : (expire ? 'Temps écoulé' : 'Explosion');

    const details = [gagne
        ? `Terminée en ${formaterTemps(tempsEcoule)}`
        : `Perdue après ${formaterTemps(tempsEcoule)}`];
    if (gagne && Number.isFinite(viesTotales) && viesTotales > 1) {
        details.push(`${vies} cœur${vies > 1 ? 's' : ''} sur ${viesTotales}`);
    }
    if (!garanti) details.push('grille non garantie sans hasard');
    elements.finDetail.textContent = details.join(' · ');

    const analyse = autopsie && !gagne ? AUTOPSIE[autopsie.verdict] : null;
    elements.finAutopsie.hidden = analyse === null;
    if (analyse) {
        const [texte, classe] = analyse;
        elements.finAutopsie.textContent = texte;
        elements.finAutopsie.className = `fin-autopsie ${classe}`;
    }

    elements.finRecord.hidden = record === undefined;
    if (record !== undefined) {
        elements.finRecord.textContent = record === null
            ? 'Premier temps sur cette configuration'
            : `Nouveau record, ${formaterTemps(record)} auparavant`;
    }

    elements.finPartager.hidden = !defi;
    elements.dialogueFin.showModal();
}
