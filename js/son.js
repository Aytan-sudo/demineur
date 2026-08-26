// Synthese WebAudio : pas un octet d'audio dans le depot, cinq timbres et c'est
// tout. Le Demineur se joue en cliquant beaucoup — creuser et poser un drapeau
// sont donc muets a dessein. Le son ne commente pas le geste, il marque les
// cinq moments qui comptent : l'accord reussi, l'explosion, la victoire, la
// defaite et l'indice demande.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de telephone ne restitue a peu
// pres rien en dessous, et l'oreille y est de surcroit bien moins sensible a
// faible volume : une note ecrite plus bas ne leve aucune erreur, elle part
// simplement sans arriver. Le jeu se voulant mobile d'abord, c'est un defaut et
// pas un reglage — `tests/test-son.mjs` garde le plancher.

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.09, volume = 0.035, delai = 0, vers = null, forme = 'triangle' } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

// L'appui sur un chiffre deja entoure de ses drapeaux : le geste qui recompense
// la deduction, et le seul empilement du jeu. Trois notes plaquees, do majeur.
export function sonAccord() {
    [523, 659, 784].forEach(frequence => note(frequence, { duree: 0.11, volume: 0.024 }));
}

// L'explosion dit non par la chute, pas par la gravite : une note ecrite dans
// le grave ne serait rien du tout sur la cible du projet, alors qu'elle
// s'entendrait parfaitement sur un ordinateur. C'est le mouvement qui porte le
// sens, et le mouvement, lui, survit au petit haut-parleur.
//
// En trois vies ou en zen, une mine coute un coeur sans finir la partie : le
// meme timbre, plus court et plus discret — un accroc, pas une fin.
export function sonExplosion({ fatale = true } = {}) {
    note(760, {
        duree: fatale ? 0.24 : 0.13,
        volume: fatale ? 0.06 : 0.03,
        vers: 320,
        forme: 'sawtooth'
    });
}

// La seule fanfare : quatre notes qui montent, la grille est deminee.
export function sonVictoire() {
    [523, 659, 784, 1047].forEach((frequence, rang) =>
        note(frequence, { duree: 0.2, delai: rang * 0.09 }));
}

// La defaite descend, lentement, mais sans passer sous le plancher. Elle part
// un quart de seconde apres le geste : quand elle suit une explosion, la
// detonation a le temps de retomber ; sur un sablier de blitz, ce retard ne
// s'entend pas.
export function sonDefaite() {
    note(494, { duree: 0.3, volume: 0.03, delai: 0.25, forme: 'sine' });
    note(330, { duree: 0.45, volume: 0.03, delai: 0.5, forme: 'sine' });
}

// L'indice coute quinze secondes : il doit s'entendre. La meme note sert
// d'accuse de reception quand on rallume le son dans les reglages.
export const sonIndice = () => note(880, { duree: 0.08, volume: 0.03 });

// Le deblocage au geste.
//
// iOS ne laisse demarrer un contexte audio que depuis un evenement
// d'activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Le Demineur en a un besoin criant : le drapeau par appui
// long naît d'un `setTimeout`, qui n'est une activation pour personne, et
// l'explosion peut donc etre le premier son de la partie sans qu'aucun
// evenement d'activation ne l'ait precede. Le contexte se prepare donc des le
// poser du doigt, avant que le jeu n'ait une note a demander.
// `autorise` evite d'ouvrir un contexte audio chez qui a coupe le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

// Un jeu ne chante pas dans le dos de qui est parti lire ailleurs.
export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
