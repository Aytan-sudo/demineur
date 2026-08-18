// Preferences et records, dans le localStorage.
//
// Un record n'a de sens que compare a ce qui lui ressemble : trois vies ou une
// grille garantie sans hasard changent completement la difficulte. La cle de
// classement embarque donc les reglages, plutot que de melanger dans un meme
// palmares des parties qui n'ont rien a voir.

const CLE_PREFERENCES = 'demineur.preferences';
const CLE_RECORDS = 'demineur.records';
const CLE_STATS = 'demineur.stats';

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
    doutes: false,
    vibration: true,
    modeDrapeau: false
};

const lire = (cle, secours) => {
    try {
        const brut = localStorage.getItem(cle);
        return brut ? { ...secours, ...JSON.parse(brut) } : { ...secours };
    } catch {
        return { ...secours };   // navigation privee, quota plein : on joue quand meme
    }
};

const ecrire = (cle, valeur) => {
    try {
        localStorage.setItem(cle, JSON.stringify(valeur));
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

export function effacerStats() {
    ecrire(CLE_STATS, { jouees: 0, gagnees: 0, serie: 0, meilleureSerie: 0 });
    ecrire(CLE_RECORDS, {});
}
