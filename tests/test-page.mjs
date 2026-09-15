// Verifications structurelles de la page : les erreurs que ces tests attrapent
// ne provoquent aucune exception, elles laissent juste une fonction muette, un
// fichier absent hors ligne ou une mise a jour invisible pour les joueurs deja
// venus.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';
import { VERSION } from '../js/config.js';

const { check, report } = counter();
console.log('\nPage\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

const page = lire('index.html');
const worker = lire('sw.js');
const interfaceJs = lire('js/ui.js');
const paquet = JSON.parse(lire('package.json'));
const modules = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));

// ------------------------------------------------------------- la version,
// aux trois endroits. Un cache qui ne change pas de nom continue de servir
// l'ancien jeu, et rien ne le signale — sauf le numero affiche au bas des
// reglages, qui vient du code reellement charge.
check('le paquet et le code s\'accordent sur la version', paquet.version === VERSION,
    `${paquet.version} vs ${VERSION}`);
check('la page affiche la meme', interfaceJs.includes('`Démineur ${VERSION}`'));
check('le cache porte la meme', worker.includes(`const VERSION = 'demineur-${VERSION}'`));
check('le numero est en semver', /^\d+\.\d+\.\d+$/.test(VERSION), VERSION);

// -------------------------------------------------------- la coquille hors
// ligne. Un fichier absent manque a l'appel : la page se charge, et l'import
// echoue en silence.
const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(trouve => trouve[1]);
const attendus = [
    'index.html', 'manifest.webmanifest',
    ...readdirSync(join(racine, 'css')).map(nom => `css/${nom}`),
    ...modules.map(nom => `js/${nom}`),
    ...readdirSync(join(racine, 'assets')).map(nom => `assets/${nom}`)
];
const oublies = attendus.filter(chemin => !coquille.includes(chemin));
check('tous les fichiers du jeu sont en cache', oublies.length === 0, oublies.join(' '));
const fantomes = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('aucun fichier fantome dans la coquille', fantomes.length === 0, fantomes.join(' '));
check('la racine est servie hors ligne', coquille.includes('./'));
check('le service worker sert le reseau d\'abord', /respondWith\(\s*fetch\(/.test(worker));
check('le service worker est enregistre par l\'application',
    lire('js/app.js').includes("navigator.serviceWorker.register('sw.js')"));

// ------------------------------------------------------------- les modules.
// Un module que plus personne ne charge est du code mort qui continue de passer
// les tests. On suit les imports depuis app.js.
const vus = new Set();
const aVoir = ['app.js'];
while (aVoir.length) {
    const nom = aVoir.pop();
    if (vus.has(nom)) continue;
    vus.add(nom);
    for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) aVoir.push(cible);
}
const orphelins = modules.filter(nom => !vus.has(nom));
check('tous les modules sont relies a l\'application', orphelins.length === 0, orphelins.join(' '));

const nonControles = modules.filter(nom => !paquet.scripts.check.includes(`js/${nom}`));
check('npm run check couvre chaque module', nonControles.length === 0, nonControles.join(' '));
check('les scripts npm attendus existent',
    ['test', 'check', 'serve'].every(nom => typeof paquet.scripts[nom] === 'string'));

// Une suite que `npm test` n'appelle pas ne protege rien, et rien ne le
// signale : le fichier dort dans le dossier, vert par absence.
const suites = readdirSync(join(racine, 'tests')).filter(nom => nom.startsWith('test-'));
const nonLancees = suites.filter(nom => !paquet.scripts.test.includes(`tests/${nom}`));
check('npm test lance chaque suite', nonLancees.length === 0, nonLancees.join(' '));

// L'integration continue rejoue les deux scripts a chaque poussee.
const ci = lire('.github/workflows/tests.yml');
check('la CI lance les tests et le controle de syntaxe',
    ci.includes('npm test') && ci.includes('npm run check') && ci.includes('node-version: 22'));
check('la CI se declenche sur push et sur pull request',
    ci.includes('push:') && ci.includes('pull_request:'));

// ------------------------------------------------------------- la page. Un
// identifiant cherche par l'interface et absent de la page donne un `null` qui
// ne se voit qu'au premier clic.
const demandes = [...interfaceJs.matchAll(/\$\('([a-z-]+)'\)/g)].map(trouve => trouve[1]);
const introuvables = [...new Set(demandes)].filter(id => !page.includes(`id="${id}"`));
check('tous les elements cherches par l\'interface existent dans la page',
    introuvables.length === 0, introuvables.join(' '));

check('la page charge l\'application en module',
    page.includes('<script type="module" src="js/app.js">'));
check('le viewport verrouille le zoom tactile', page.includes('user-scalable=no'));

// Le script pose-theme est recopie a la main dans le HTML : s'il lit une autre
// cle que le module de stockage, le theme clignote a chaque ouverture.
check('le script d\'amorce lit la meme cle que le stockage',
    page.includes("getItem('demineur.preferences')")
    && lire('js/storage.js').includes("CLE_PREFERENCES = 'demineur.preferences'"));

// Le manifeste porte l'identite du jeu : un champ perdu casse l'installation
// sur telephone, et la carte du hub qui le lit.
const manifeste = JSON.parse(lire('manifest.webmanifest'));
check('le manifeste a un nom et une description',
    manifeste.name.length > 0 && manifeste.description.length > 0);
check('le manifeste declare ses icones',
    manifeste.icons.length >= 2 && manifeste.icons.every(icone => icone.src.startsWith('assets/')));
check('toutes les icones du manifeste existent',
    manifeste.icons.every(icone => existsSync(join(racine, icone.src))),
    manifeste.icons.map(icone => icone.src).filter(src => !existsSync(join(racine, src))).join(' '));
// iOS n'accepte pas le SVG en icone d'accueil : sans ce PNG, l'application
// installee prend une capture d'ecran degradee a la place.
check('l\'icone d\'accueil iOS est un PNG',
    page.includes('rel="apple-touch-icon" href="assets/icon-180.png"'));
// La page et le manifeste doivent annoncer la meme couleur de depart, sinon
// l'ecran de lancement de l'application installee clignote au demarrage.
check('la page et le manifeste s\'accordent sur la couleur de depart',
    page.includes(`content="${manifeste.theme_color}"`)
    && manifeste.background_color === manifeste.theme_color, manifeste.theme_color);

report();
