import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, IDS_THEMES, themeSuivant, themeConnu, THEME_PAR_DEFAUT, libelleDuTheme } from '../js/themes.js';
import { PREFERENCES_PAR_DEFAUT } from '../js/storage.js';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nThemes\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const feuille = readFileSync(join(racine, 'css', 'style.css'), 'utf8');
const page = readFileSync(join(racine, 'index.html'), 'utf8');

// ------------------------------------------------------------------- liste

check('les identifiants sont uniques', new Set(IDS_THEMES).size === IDS_THEMES.length);
check('le clair est le theme par defaut', THEME_PAR_DEFAUT === 'clair');
check('les preferences demarrent sur le theme par defaut',
    PREFERENCES_PAR_DEFAUT.theme === THEME_PAR_DEFAUT);
check('chaque theme a un libelle et une phrase',
    THEMES.every(theme => theme.libelle.length > 0 && theme.resume.length > 0));
check('un identifiant inconnu est rejete',
    themeConnu('clair') && !themeConnu('fuchsia'));
check('libelleDuTheme retombe sur le defaut si besoin',
    libelleDuTheme('fuchsia') === libelleDuTheme(THEME_PAR_DEFAUT));

// Le bouton fait tourner la liste : il doit la parcourir entierement et
// revenir a son point de depart, sans jamais se bloquer.
let courant = THEME_PAR_DEFAUT;
const parcourus = [courant];
for (let pas = 0; pas < IDS_THEMES.length - 1; pas++) {
    courant = themeSuivant(courant);
    parcourus.push(courant);
}
check('le bouton passe par tous les themes', new Set(parcourus).size === IDS_THEMES.length, parcourus);
check('et revient au point de depart', themeSuivant(courant) === THEME_PAR_DEFAUT);
check('un theme inconnu ramene au debut de la liste',
    themeSuivant('fuchsia') === IDS_THEMES[0]);

// ------------------------------------------------------------------ palettes

// Le theme clair est la reference : il vit dans `:root` et sert de repli. Tout
// ce qu'il declare, les autres doivent le redeclarer — une variable oubliee ne
// provoque aucune erreur, elle laisse juste une couleur claire au milieu d'un
// theme sombre, ce qui se remarque tard et se cherche longtemps.
const bloc = selecteur => {
    const debut = feuille.indexOf(selecteur + ' {');
    if (debut === -1) return null;
    return feuille.slice(debut, feuille.indexOf('}', debut));
};

// On ne compare que les couleurs : `--radius` et consorts sont des mesures,
// communes a tous les themes et declarees une seule fois.
const estUneCouleur = valeur => /^(#|rgba?\(|\d+\s*,)/.test(valeur.trim());

const variablesDe = texte => new Set(
    [...texte.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)]
        .filter(([, , valeur]) => estUneCouleur(valeur))
        .map(([, nom]) => nom)
);

const reference = bloc(':root');
check('le theme clair est defini sur :root', reference !== null);

const attendues = variablesDe(reference);
check('la palette de reference compte toutes ses couleurs', attendues.size > 25, attendues.size);

for (const { id } of THEMES.filter(theme => theme.id !== 'clair')) {
    const declaration = bloc(`:root[data-theme="${id}"]`);
    if (declaration === null) {
        check(`le theme ${id} a sa palette`, false);
        continue;
    }
    const definies = variablesDe(declaration);
    const manquantes = [...attendues].filter(nom => !definies.has(nom));
    check(`le theme ${id} redefinit toute la palette`, manquantes.length === 0, manquantes.join(' '));
}

// Le canvas lit ces variables par leur nom : si l'une disparait de la feuille
// de style, la grille se dessine en transparent sans que rien ne proteste.
const LUES_PAR_LE_CANVAS = [
    '--grille-fond', '--case-fermee', '--case-enfoncee', '--case-ouverte',
    '--case-explosee', '--mine', '--mine-explosee', '--drapeau-mat', '--rouge',
    '--doute', '--indice', '--eclat-explosion',
    '--chiffre-1', '--chiffre-2', '--chiffre-3', '--chiffre-4',
    '--chiffre-5', '--chiffre-6', '--chiffre-7', '--chiffre-8'
];
check('la feuille de style fournit tout ce que le canvas y cherche',
    LUES_PAR_LE_CANVAS.every(nom => attendues.has(nom)),
    LUES_PAR_LE_CANVAS.filter(nom => !attendues.has(nom)).join(' '));

// ------------------------------------------------------- pose avant affichage

// Le theme est pose par un script en tete de page, avant le premier rendu :
// charge comme module, il arriverait apres et l'ecran clignoterait.
check('la page pose le theme avant de s\'afficher',
    page.includes('localStorage.getItem(\'demineur.preferences\')')
    && page.indexOf('demineur.preferences') < page.indexOf('<body'));

report();
