// Tout ce qui touche au DOM autour de la grille : compteurs, dialogues,
// reglages. La grille elle-meme est dessinee par render.js.

import { DIFFICULTES, minesMaximales } from './engine.js';
import { chargerRecords, chargerStats } from './storage.js';

const $ = identifiant => document.getElementById(identifiant);

export const elements = {
    canvas: $('grille'),
    valeurMines: $('valeur-mines'),
    valeurTemps: $('valeur-temps'),
    vies: $('vies'),
    visage: $('bouton-rejouer'),
    annonce: $('annonce'),
    bascule: $('bascule-mode'),
    basculeTexte: document.querySelector('.bascule-texte'),
    astuce: $('astuce'),
    dialogueFin: $('dialogue-fin'),
    finTitre: $('fin-titre'),
    finDetail: $('fin-detail'),
    finRecord: $('fin-record'),
    dialogueReglages: $('dialogue-reglages'),
    dialogueAide: $('dialogue-aide')
};

export function formaterTemps(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

export function majCompteurs({ mines, temps }) {
    elements.valeurMines.textContent = String(mines);
    elements.valeurTemps.textContent = formaterTemps(temps);
}

export function majVies(restantes, total) {
    if (total <= 1) {
        elements.vies.hidden = true;
        return;
    }
    elements.vies.hidden = false;
    elements.vies.innerHTML = Array.from({ length: total }, (_, position) =>
        `<span class="${position < restantes ? '' : 'perdue'}">❤</span>`).join('');
}

export const majVisage = tete => { elements.visage.textContent = tete; };

let minuterieAnnonce = null;

export function annoncer(texte, duree = 2400) {
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

// ------------------------------------------------------------------ records

const LIBELLES_VARIANTES = { sh: 'sans hasard', std: 'classique' };

function libelleClassement(cle) {
    const [format, variante, vies] = cle.split('|');
    const nom = DIFFICULTES[format]?.libelle ?? format.replace('perso-', 'Perso ');
    const coeurs = vies === 'v1' ? '' : ` · ${vies.slice(1)} vies`;
    return `${nom} · ${LIBELLES_VARIANTES[variante] ?? variante}${coeurs}`;
}

export function majRecords() {
    const stats = chargerStats();
    const resume = document.getElementById('resume-stats');
    resume.textContent = stats.jouees === 0
        ? 'Aucune partie jouée'
        : `${stats.jouees} partie${stats.jouees > 1 ? 's' : ''} · `
          + `${Math.round((stats.gagnees / stats.jouees) * 100)} % de victoires · `
          + `série de ${stats.serie} (record ${stats.meilleureSerie})`;

    const records = chargerRecords();
    const liste = $('liste-records');
    const entrees = Object.entries(records).sort((a, b) => a[0].localeCompare(b[0]));

    liste.innerHTML = entrees.length === 0
        ? '<li class="vide">Aucun temps enregistré</li>'
        : entrees.map(([cle, temps]) =>
            `<li><span>${libelleClassement(cle)}</span><span>${formaterTemps(temps)}</span></li>`).join('');
}

// ----------------------------------------------------------------- reglages

// Rend les champs coherents avec les preferences en cours et renvoie le nombre
// de mines maximal acceptable, dont l'appelant se sert pour brider la saisie.
export function refletDesReglages(preferences) {
    for (const bouton of document.querySelectorAll('#segments-difficulte .segment')) {
        bouton.setAttribute('aria-pressed', String(bouton.dataset.difficulte === preferences.difficulte));
    }

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

    $('option-sans-hasard').checked = preferences.sansHasard;
    $('option-vies').checked = preferences.vies > 1;
    $('option-doutes').checked = preferences.doutes;
    $('option-vibration').checked = preferences.vibration;

    majRecords();
    return maximum;
}

export function ouvrirFin({ gagne, temps, record, garanti, vies, viesTotales }) {
    elements.finTitre.textContent = gagne ? 'Grille déminée' : 'Explosion';

    const details = [gagne ? `Terminée en ${formaterTemps(temps)}` : `Perdue après ${formaterTemps(temps)}`];
    if (gagne && viesTotales > 1) details.push(`${vies} cœur${vies > 1 ? 's' : ''} sur ${viesTotales}`);
    if (!garanti) details.push('grille non garantie sans hasard');
    elements.finDetail.textContent = details.join(' · ');

    elements.finRecord.hidden = record === undefined;
    if (record !== undefined) {
        elements.finRecord.textContent = record === null
            ? 'Premier temps sur cette configuration'
            : `Nouveau record, ${formaterTemps(record)} auparavant`;
    }
    elements.dialogueFin.showModal();
}
