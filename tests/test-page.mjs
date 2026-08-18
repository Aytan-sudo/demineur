// Verifications structurelles de la page : les erreurs que ces tests attrapent
// ne provoquent aucune exception, elles laissent juste une fonction muette ou
// une mise a jour invisible pour les joueurs deja venus.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nPage\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

const page = lire('index.html');
const worker = lire('sw.js');
const interfaceJs = lire('js/ui.js');

// Un module absent de la coquille du service worker manque a l'appel hors
// ligne : la page se charge, et l'import echoue en silence.
const modules = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));
const absents = modules.filter(nom => !worker.includes(`js/${nom}`));
check('le service worker connait tous les modules', absents.length === 0, absents.join(' '));

check('le service worker met en cache la feuille de style', worker.includes('css/style.css'));
check('le service worker porte un numero de version',
    /const VERSION = 'demineur-v\d+'/.test(worker));

// Chaque identifiant cherche par l'interface doit exister dans la page : une
// faute de frappe donne un `null` qui ne se voit qu'au premier clic.
const demandes = [...interfaceJs.matchAll(/\$\('([a-z-]+)'\)/g)].map(m => m[1]);
const introuvables = [...new Set(demandes)].filter(id => !page.includes(`id="${id}"`));
check('tous les elements cherches par l\'interface existent dans la page',
    introuvables.length === 0, introuvables.join(' '));

check('la page charge l\'application en module',
    page.includes('<script type="module" src="js/app.js">'));

// Le manifeste porte l'identite du jeu : un champ perdu casse l'installation
// sur telephone, et la carte du hub qui le lit.
const manifeste = JSON.parse(lire('manifest.webmanifest'));
check('le manifeste a un nom et une description',
    manifeste.name.length > 0 && manifeste.description.length > 0);
check('le manifeste declare ses icones',
    manifeste.icons.length >= 2 && manifeste.icons.every(icone => icone.src.startsWith('assets/')));
// La page et le manifeste doivent annoncer la meme couleur de depart, sinon
// l'ecran de lancement de l'application installee clignote au demarrage.
check('la page et le manifeste s\'accordent sur la couleur de depart',
    page.includes(`content="${manifeste.theme_color}"`)
    && manifeste.background_color === manifeste.theme_color, manifeste.theme_color);

report();
