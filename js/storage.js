// Preferences et records, dans le localStorage.
//
// Un record n'a de sens que compare a ce qui lui ressemble : trois vies ou une
// grille garantie sans hasard changent completement la difficulte. La cle de
// classement embarque donc les reglages, plutot que de melanger dans un meme
// palmares des parties qui n'ont rien a voir.

const CLE_PREFERENCES = 'demineur.preferences';
const CLE_RECORDS = 'demineur.records';
const CLE_STATS = 'demineur.stats';
const CLE_PASSEPORT = 'demineur.passeport';

// Ouvert depuis le hub avec un passeport, le jeu range tout dans l'espace du
// joueur ; en mode invité, directement dans localStorage, comme avant.
const passeport = globalThis.Passeport?.stockageJeu('demineur') ?? null;
const magasin = () => passeport ?? localStorage;

export const PREFERENCES_PAR_DEFAUT = {
    difficulte: 'facile',
    colonnes: 9,
    lignes: 9,
    mines: 10,
    sansHasard: true,
    topologie: 'carre',
    enroule: false,
    chiffres: 'exacts',
    rythme: 'classique',
    theme: 'clair',
    doutes: false,
    sons: true,
    vibration: true,
    modeDrapeau: false
};

const lire = (cle, secours) => {
    try {
        const brut = magasin().getItem(cle);
        return brut ? { ...secours, ...JSON.parse(brut) } : { ...secours };
    } catch {
        return { ...secours };   // navigation privee, quota plein : on joue quand meme
    }
};

const ecrire = (cle, valeur) => {
    try {
        magasin().setItem(cle, JSON.stringify(valeur));
    } catch { /* sans persistance, le jeu reste jouable */ }
};

export const chargerPreferences = () => lire(CLE_PREFERENCES, PREFERENCES_PAR_DEFAUT);
export const enregistrerPreferences = preferences => ecrire(CLE_PREFERENCES, preferences);

// Un temps ne se compare qu'a ce qui lui ressemble : la forme du plateau et la
// sincerite des chiffres changent trop la difficulte pour melanger les tableaux.
export function cleDeClassement(config) {
    const { difficulte, colonnes, lignes, mines } = config;
    const format = difficulte === 'perso' ? `perso-${colonnes}x${lignes}-${mines}` : difficulte;

    const traits = [
        config.topologie === 'carre' ? null : config.topologie,
        config.enroule ? 'tore' : null,
        config.chiffres && config.chiffres !== 'exacts' ? config.chiffres : null,
        config.sansHasard ? 'sh' : 'std',
        config.rythme && config.rythme !== 'classique' ? config.rythme : null
    ].filter(Boolean);

    return [format, ...traits].join('|');
}

export const chargerRecords = () => lire(CLE_RECORDS, {});

// { record: true } quand le temps est meilleur que tout ce qui est enregistre
// pour cette configuration ; `ancien` vaut null s'il n'y avait rien encore.
export function enregistrerRecord(cle, tempsMs) {
    const records = chargerRecords();
    const ancien = records[cle] ?? null;
    if (ancien !== null && ancien <= tempsMs) return { record: false, ancien };
    records[cle] = tempsMs;
    ecrire(CLE_RECORDS, records);
    return { record: true, ancien };
}

export const chargerStats = () => lire(CLE_STATS, { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0 });

export function enregistrerPartie(gagnee) {
    const stats = chargerStats();
    stats.jouees++;
    if (gagnee) {
        stats.gagnees++;
        stats.serie++;
        stats.meilleureSerie = Math.max(stats.meilleureSerie, stats.serie);
    } else {
        stats.serie = 0;
    }
    ecrire(CLE_STATS, stats);
    return stats;
}

// Le tampon Logique du passeport récompense une grille déminée, ou l'effort :
// dix parties jouées jusqu'au bout dans la journée, explosions comprises.
// Renvoie le nombre de parties du jour, ou null en mode invité (rien à compter).
export function compterPartiePasseport(jour, coffre = passeport) {
    if (!coffre) return null;
    let compte = null;
    try { compte = JSON.parse(coffre.getItem(CLE_PASSEPORT)); } catch { /* compteur illisible : on repart */ }
    const parties = compte?.jour === jour && Number.isInteger(compte.parties) ? compte.parties + 1 : 1;
    try { coffre.setItem(CLE_PASSEPORT, JSON.stringify({ jour, parties })); } catch { /* le passeport signale l'échec */ }
    return parties;
}

export function effacerStats() {
    ecrire(CLE_STATS, { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0 });
    ecrire(CLE_RECORDS, {});
}
