// Gestes : souris, doigt et stylet passent tous par les evenements Pointer.
//
// Le point delicat est le telephone. Le clic droit n'existe pas, et l'appui
// long seul ne suffit pas : il est lent et imprecis des qu'on enchaine les
// drapeaux. Le jeu offre donc les deux, un bouton bascule creuser/drapeau pour
// le rythme, l'appui long pour l'action inverse sans quitter le mode courant.

import { CACHEE, REVELEE, DOUTE } from './engine.js';

const SEUIL_GLISSE_DOIGT = 12;
const SEUIL_GLISSE_SOURIS = 5;
const DUREE_APPUI_LONG = 420;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function brancherEntrees(canvas, rendu, actions) {
    const pointeurs = new Map();
    let geste = null;       // { index, depart, deplace, minuterie, type }
    let pincement = null;   // { ecart, centre }

    const positionLocale = evenement => {
        const rect = canvas.getBoundingClientRect();
        return { x: evenement.clientX - rect.left, y: evenement.clientY - rect.top };
    };

    const vibrer = duree => navigator.vibrate?.(duree);

    function enfoncer(index) {
        rendu.enfoncees.clear();
        if (index < 0) return;
        const partie = rendu.partie;
        if (!partie) return;

        if (partie.etat[index] === REVELEE && partie.chiffres[index] > 0) {
            for (const voisin of partie.plateau.voisins[index]) {
                if (partie.etat[voisin] === CACHEE) rendu.enfoncees.add(voisin);
            }
        } else if (partie.etat[index] === CACHEE || partie.etat[index] === DOUTE) {
            rendu.enfoncees.add(index);
        }
        actions.rafraichir();
    }

    function relacher() {
        if (rendu.enfoncees.size > 0) {
            rendu.enfoncees.clear();
            actions.rafraichir();
        }
    }

    // Un appui sur une case ouverte vaut toujours accord ; sur une case fermee,
    // creuser ou marquer selon le mode et selon qu'on inverse ou non.
    function agir(index, inverse) {
        const partie = rendu.partie;
        if (!partie || index < 0) return;

        if (partie.etat[index] === REVELEE) {
            actions.accord(index);
            return;
        }
        const marquer = actions.modeDrapeau() !== inverse;
        if (marquer) actions.drapeau(index);
        else actions.reveler(index);
    }

    canvas.addEventListener('contextmenu', evenement => evenement.preventDefault());

    canvas.addEventListener('pointerdown', evenement => {
        // La capture garde le geste meme si le doigt sort du canvas. Elle
        // echoue sur certains pointeurs synthetiques : le jeu doit continuer.
        try { canvas.setPointerCapture(evenement.pointerId); } catch { /* sans capture */ }
        const position = positionLocale(evenement);
        pointeurs.set(evenement.pointerId, position);

        if (pointeurs.size === 2) {
            // deux doigts : on abandonne le tap en cours, on passe en zoom
            if (geste?.minuterie) clearTimeout(geste.minuterie);
            geste = null;
            relacher();
            const [a, b] = [...pointeurs.values()];
            pincement = {
                ecart: distance(a, b),
                centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            };
            return;
        }
        if (pointeurs.size > 2) return;

        const index = rendu.caseSous(position.x, position.y);
        geste = {
            id: evenement.pointerId,
            index,
            depart: position,
            derniere: position,
            deplace: false,
            tactile: evenement.pointerType !== 'mouse',
            bouton: evenement.button,
            minuterie: null
        };

        if (evenement.button === 0) enfoncer(index);

        if (geste.tactile && index >= 0) {
            geste.minuterie = setTimeout(() => {
                if (!geste || geste.deplace) return;
                geste.minuterie = null;
                geste.consomme = true;
                vibrer(18);
                relacher();
                agir(index, true);      // action inverse du mode courant
            }, DUREE_APPUI_LONG);
        }
    });

    canvas.addEventListener('pointermove', evenement => {
        if (!pointeurs.has(evenement.pointerId)) return;
        const position = positionLocale(evenement);
        const precedente = pointeurs.get(evenement.pointerId);
        pointeurs.set(evenement.pointerId, position);

        if (pincement && pointeurs.size === 2) {
            const [a, b] = [...pointeurs.values()];
            const ecart = distance(a, b);
            const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const facteur = ecart / (pincement.ecart || ecart);

            zoomer(facteur, centre.x, centre.y);
            rendu.vue.x += centre.x - pincement.centre.x;
            rendu.vue.y += centre.y - pincement.centre.y;
            rendu.borner();
            pincement = { ecart, centre };
            actions.rafraichir();
            return;
        }

        if (!geste || evenement.pointerId !== geste.id) return;

        const seuil = geste.tactile ? SEUIL_GLISSE_DOIGT : SEUIL_GLISSE_SOURIS;
        if (!geste.deplace && distance(position, geste.depart) > seuil) {
            geste.deplace = true;
            if (geste.minuterie) clearTimeout(geste.minuterie);
            relacher();
        }
        if (geste.deplace) {
            rendu.vue.x += position.x - precedente.x;
            rendu.vue.y += position.y - precedente.y;
            rendu.borner();
            actions.rafraichir();
        }
    });

    function terminerPointeur(evenement) {
        pointeurs.delete(evenement.pointerId);
        if (pointeurs.size < 2) pincement = null;
        if (!geste || evenement.pointerId !== geste.id) return;

        if (geste.minuterie) clearTimeout(geste.minuterie);
        relacher();

        const fini = geste;
        geste = null;
        if (fini.deplace || fini.consomme) return;
        if (evenement.type === 'pointercancel') return;

        // bouton droit ou molette : action inverse, comme l'appui long
        agir(fini.index, fini.bouton === 2 || fini.bouton === 1);
    }

    canvas.addEventListener('pointerup', terminerPointeur);
    canvas.addEventListener('pointercancel', terminerPointeur);

    function zoomer(facteur, centreX, centreY) {
        const vue = rendu.vue;
        const avant = vue.echelle;
        vue.echelle = Math.max(0.35, Math.min(2.4, vue.echelle * facteur));
        const rapport = vue.echelle / avant;
        vue.x = centreX - (centreX - vue.x) * rapport;
        vue.y = centreY - (centreY - vue.y) * rapport;
        rendu.borner();
    }

    canvas.addEventListener('wheel', evenement => {
        evenement.preventDefault();
        const position = positionLocale(evenement);
        zoomer(Math.exp(-evenement.deltaY * 0.0015), position.x, position.y);
        actions.rafraichir();
    }, { passive: false });
}
