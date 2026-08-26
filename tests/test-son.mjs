// Le son — tout ce qui se verifie sans oreille.
//
// Le piege que cette suite existe pour attraper ne leve aucune erreur et ne se
// voit pas depuis un ordinateur : une note ecrite sous 300 Hz part bien, elle
// n'arrive simplement jamais. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume. Compter les notes emises ne dit donc rien de ce qui parvient a
// l'oreille : c'est leur hauteur qu'il faut relever.
//
// Un contexte audio factice fait tourner le vrai module et note ce qui en sort,
// cibles de rampes comprises (le modele : Mosaicomino). Le releve a la source
// reste en second rideau, pour attraper un timbre ajoute sans passer par ici.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nSon\n');

// Un haut-parleur de telephone ne descend pas plus bas. C'est la cible du
// projet : sous ce seuil, la note n'existe pas.
const PLANCHER = 300;

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');

// Le banc d'essai : juste assez d'API WebAudio pour que `js/son.js` tourne, et
// un carnet ou chaque oscillateur laisse ses hauteurs et son enveloppe.
function bancDEssai() {
    const emises = [];
    class Parametre {
        constructor(carnet) { this.carnet = carnet; }
        setValueAtTime(valeur) { this.carnet.push(valeur); return this; }
        exponentialRampToValueAtTime(valeur) { this.carnet.push(valeur); return this; }
    }
    class Contexte {
        constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
        // `note()` cree toujours l'oscillateur puis son gain : la derniere note
        // ouverte est donc bien celle que ce gain habille.
        createOscillator() {
            const note = { forme: null, hauteurs: [], gains: [], debut: null, fin: null };
            emises.push(note);
            return {
                set type(valeur) { note.forme = valeur; },
                get type() { return note.forme; },
                frequency: new Parametre(note.hauteurs),
                connect: cible => cible,
                start: temps => { note.debut = temps; },
                stop: temps => { note.fin = temps; }
            };
        }
        createGain() {
            return { gain: new Parametre(emises.at(-1).gains), connect: cible => cible };
        }
        resume() { this.state = 'running'; }
        suspend() { this.state = 'suspended'; }
    }
    globalThis.AudioContext = Contexte;
    return emises;
}

const emises = bancDEssai();
const { sonAccord, sonExplosion, sonVictoire, sonDefaite, sonIndice } = await import('../js/son.js');

const jouer = (timbre, ...arguments_) => {
    const debut = emises.length;
    timbre(...arguments_);
    return emises.slice(debut);
};

const accord = jouer(sonAccord);
const explosion = jouer(sonExplosion);
const accroc = jouer(sonExplosion, { fatale: false });
const victoire = jouer(sonVictoire);
const defaite = jouer(sonDefaite);
const indice = jouer(sonIndice);

check('les cinq timbres sonnent', emises.length === 12, `${emises.length} notes`);

// Le coeur de la suite : plus rien, pas meme une cible de rampe, ne descend
// sous le plancher.
const sous = emises.flatMap(note => note.hauteurs).filter(hauteur => hauteur < PLANCHER);
check('aucune note ne passe sous le plancher du haut-parleur',
    sous.length === 0, sous.map(hauteur => `${Math.round(hauteur)} Hz`).join(' '));

// L'accord est le seul empilement du jeu : trois notes ensemble, pas egrenees.
check('l\'accord plaque trois notes d\'un coup',
    accord.length === 3 && accord.every(note => note.debut === accord[0].debut));
check('l\'accord monte', accord[0].hauteurs[0] < accord[2].hauteurs[0]);

// L'explosion ne dit plus non par la profondeur — qu'aucun telephone ne
// restituerait — mais par la chute. C'est cette intention que le test garde.
check('l\'explosion descend au lieu de s\'enfoncer',
    explosion.length === 1 && explosion[0].hauteurs.length === 2
    && explosion[0].hauteurs[0] > explosion[0].hauteurs[1]
    && explosion[0].hauteurs[1] >= PLANCHER,
    explosion[0]?.hauteurs.join(' → '));

const volume = note => Math.max(...note.gains);
const duree = note => note.fin - note.debut;

// Une mine qui coute un coeur n'est pas une fin de partie : meme timbre, plus
// court et plus discret.
check('l\'accroc reste plus bref que l\'explosion fatale', duree(accroc[0]) < duree(explosion[0]));
check('l\'accroc reste plus discret que l\'explosion fatale', volume(accroc[0]) < volume(explosion[0]));

// La fanfare monte : c'est ce qui la fait entendre comme une fin heureuse.
const montee = victoire.map(note => note.hauteurs[0]);
check('la victoire monte de bout en bout',
    montee.every((hauteur, rang) => rang === 0 || hauteur > montee[rang - 1]), montee.join(' '));
check('la victoire s\'egrene au lieu de plaquer un accord',
    victoire.every((note, rang) => rang === 0 || note.debut > victoire[rang - 1].debut));

// La defaite descend, et laisse retomber la detonation qu'elle suit souvent.
const descente = defaite.map(note => note.hauteurs[0]);
check('la defaite descend',
    descente.every((hauteur, rang) => rang === 0 || hauteur < descente[rang - 1]), descente.join(' '));
check('la defaite attend que l\'explosion retombe', defaite[0].debut >= 0.2, String(defaite[0].debut));

// L'indice coute quinze secondes : il s'entend, mais il reste une seule note.
check('l\'indice tient en une note breve', indice.length === 1 && duree(indice[0]) < duree(explosion[0]));

// Creuser et marquer sont muets a dessein : le Demineur se joue en cliquant
// beaucoup, et un son par case ferait un crepitement. Rien dans le module ne
// doit se mettre a sonner sur ces deux gestes-la.
const source = lire('js/son.js');
check('creuser et marquer n\'ont pas de timbre',
    !/export\s+(const|function)\s+son(Creuser|Drapeau|Marquer)/.test(source));
const app = lire('js/app.js');
check('l\'appel du son suit la meme porte que la vibration',
    app.includes('const sonner = ') && app.includes('preferences.sons'));

// Second rideau : un timbre ajoute demain sans passer par cette suite serait
// invisible au banc d'essai. On relit donc aussi le module au lexique.
const ecrites = [
    ...[...source.matchAll(/note\((\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/vers:\s*(\d+)/g)].map(([, valeur]) => Number(valeur)),
    ...[...source.matchAll(/^\s*\[([\d,\s]+)\]\.forEach/gm)]
        .flatMap(([, liste]) => liste.split(',').map(Number))
];
const basses = ecrites.filter(hauteur => hauteur < PLANCHER);
check('aucune frequence ecrite dans le module ne passe sous le plancher',
    basses.length === 0, basses.join(' '));
check('les frequences ecrites ont bien ete relevees', ecrites.length >= 11, String(ecrites.length));

// Le second piege du son sur telephone : iOS ne demarre un contexte audio que
// depuis un evenement d'activation. Ici le drapeau par appui long naît d'un
// `setTimeout` et le sablier du blitz d'un tic d'horloge : ni l'un ni l'autre
// n'en est un. D'ou le filet pose des le poser du doigt.
check('le contexte se prepare des le premier geste',
    source.includes("'pointerdown'") && app.includes('preparerSon(document'));
check('le son se tait quand l\'onglet passe a l\'arriere-plan',
    app.includes('surveillerVisibilite(document)'));

report();
