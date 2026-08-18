// Les themes disponibles, dans l'ordre du bouton.
//
// Ce module ne contient aucune couleur : elles vivent toutes dans la feuille de
// style, sous `:root[data-theme="..."]`. Ici, on ne tient que la liste et son
// ordre — et un test verifie que chaque entree a bien sa palette en face, au
// complet.

export const THEMES = [
    {
        id: 'clair',
        libelle: 'Clair',
        resume: 'Gris bleutés, neutre et reposant. Le thème par défaut.'
    },
    {
        id: 'papier',
        libelle: 'Papier',
        resume: 'Crème et encre brune, comme une grille imprimée.'
    },
    {
        id: 'rose',
        libelle: 'Rose',
        resume: 'Rose poudré et prune, tout en douceur.'
    },
    {
        id: 'sombre',
        libelle: 'Sombre',
        resume: 'Bleu nuit, pour jouer le soir sans s\'éblouir.'
    },
    {
        id: 'nuit',
        libelle: 'Nuit ambrée',
        resume: 'Sombre mais chaud, sans lumière bleue.'
    },
    {
        id: 'contraste',
        libelle: 'Contraste',
        resume: 'Noir franc et couleurs saturées, lisible en plein soleil.'
    }
];

export const IDS_THEMES = THEMES.map(theme => theme.id);

export const themeConnu = id => IDS_THEMES.includes(id);

export const THEME_PAR_DEFAUT = THEMES[0].id;

// Le bouton fait tourner la liste ; les reglages, eux, donnent l'acces direct.
export function themeSuivant(courant) {
    const position = IDS_THEMES.indexOf(courant);
    return IDS_THEMES[(position + 1) % IDS_THEMES.length];
}

export const libelleDuTheme = id =>
    THEMES.find(theme => theme.id === id)?.libelle ?? THEMES[0].libelle;
