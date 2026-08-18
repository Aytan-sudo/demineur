// Rendu de la grille sur un canvas, et rien d'autre : pas de regles ici.
//
// Pourquoi un canvas plutot que des elements DOM ? Une grille d'expert fait 480
// cases ; en DOM, chaque ouverture en nappe declenche autant de recalculs de
// style, et ca se sent sur telephone. Le canvas dessine la meme scene en un
// passage, et il ouvre la porte aux plateaux non carres des futures variantes.
//
// La vue (zoom et deplacement) vit ici aussi : c'est le seul endroit qui sait
// convertir un pixel d'ecran en numero de case.

import { CACHEE, REVELEE, DRAPEAU, DOUTE, PERDU, GAGNE } from './engine.js';

const CASE = 34;              // taille d'une case dans le repere de la grille
const MARGE = 8;

const COULEURS_CHIFFRES = [
    '', '#4aa3ff', '#3ddc84', '#ff6b6b', '#b98cff',
    '#ffb454', '#35d6c8', '#ff8bd1', '#c3ccd9'
];

const DUREE_REVELATION = 220;
const DECALAGE_VAGUE = 16;    // ms de retard par anneau : l'ouverture se deroule
const DUREE_EXPLOSION = 700;

const arrondi = (ctx, x, y, largeur, hauteur, rayon) => {
    if (ctx.roundRect) ctx.roundRect(x, y, largeur, hauteur, rayon);
    else ctx.rect(x, y, largeur, hauteur);
};

const attenuation = t => 1 - Math.pow(1 - t, 3);

export function creerRendu(canvas) {
    const ctx = canvas.getContext('2d');
    const vue = { echelle: 1, x: 0, y: 0 };
    const animations = new Map();   // index -> { debut, type }
    const enfoncees = new Set();    // cases maintenues sous le doigt

    let partie = null;
    let largeur = 0;
    let hauteur = 0;
    let secousse = 0;

    const mondeLargeur = () => partie.plateau.colonnes * CASE + MARGE * 2;
    const mondeHauteur = () => partie.plateau.lignes * CASE + MARGE * 2;

    // Une case doit rester assez grande pour le pouce. Quand la grille ne tient
    // pas a cette taille, on ne retrecit pas davantage : on laisse le joueur
    // faire glisser la vue.
    const echelleMinimale = () => {
        const grossier = window.matchMedia?.('(pointer: coarse)').matches;
        return (grossier ? 30 : 22) / CASE;
    };

    function borner() {
        const largeurMonde = mondeLargeur() * vue.echelle;
        const hauteurMonde = mondeHauteur() * vue.echelle;

        vue.x = largeurMonde <= largeur
            ? (largeur - largeurMonde) / 2
            : Math.min(0, Math.max(largeur - largeurMonde, vue.x));
        vue.y = hauteurMonde <= hauteur
            ? (hauteur - hauteurMonde) / 2
            : Math.min(0, Math.max(hauteur - hauteurMonde, vue.y));
    }

    function ajusterVue() {
        if (!partie) return;
        const ideal = Math.min(largeur / mondeLargeur(), hauteur / mondeHauteur());
        vue.echelle = Math.max(echelleMinimale(), Math.min(ideal, 1.4));
        borner();
    }

    function redimensionner() {
        const rect = canvas.getBoundingClientRect();
        const densite = Math.min(window.devicePixelRatio || 1, 2.5);
        largeur = rect.width;
        hauteur = rect.height;
        canvas.width = Math.round(largeur * densite);
        canvas.height = Math.round(hauteur * densite);
        ctx.setTransform(densite, 0, 0, densite, 0, 0);
    }

    const caseSous = (px, py) => {
        if (!partie) return -1;
        const x = Math.floor((px - vue.x - MARGE * vue.echelle) / (CASE * vue.echelle));
        const y = Math.floor((py - vue.y - MARGE * vue.echelle) / (CASE * vue.echelle));
        if (x < 0 || y < 0 || x >= partie.plateau.colonnes || y >= partie.plateau.lignes) return -1;
        return y * partie.plateau.colonnes + x;
    };

    // ------------------------------------------------------------- dessins

    function dessinerDrapeau(x, y, taille, pale) {
        const u = taille / 34;
        ctx.strokeStyle = pale ? '#6b7484' : '#d7dde8';
        ctx.lineWidth = 2 * u;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 13 * u, y + 8 * u);
        ctx.lineTo(x + 13 * u, y + 25 * u);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + 9 * u, y + 26 * u);
        ctx.lineTo(x + 21 * u, y + 26 * u);
        ctx.stroke();

        ctx.fillStyle = pale ? '#7c5560' : '#e7002a';
        ctx.beginPath();
        ctx.moveTo(x + 13 * u, y + 8 * u);
        ctx.lineTo(x + 25 * u, y + 13 * u);
        ctx.lineTo(x + 13 * u, y + 18 * u);
        ctx.closePath();
        ctx.fill();
    }

    function dessinerMine(x, y, taille, couleur) {
        const u = taille / 34;
        const cx = x + 17 * u;
        const cy = y + 17 * u;
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        for (let angle = 0; angle < 8; angle++) {
            const a = (angle * Math.PI) / 4;
            ctx.moveTo(cx + Math.cos(a) * 4 * u, cy + Math.sin(a) * 4 * u);
            ctx.lineTo(cx + Math.cos(a) * 10 * u, cy + Math.sin(a) * 10 * u);
        }
        ctx.stroke();

        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5 * u, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(cx - 2 * u, cy - 2.4 * u, 1.6 * u, 0, Math.PI * 2);
        ctx.fill();
    }

    function dessinerCase(index, temps) {
        const colonnes = partie.plateau.colonnes;
        const x = MARGE + (index % colonnes) * CASE;
        const y = MARGE + Math.floor(index / colonnes) * CASE;
        const etat = partie.etat[index];
        const animation = animations.get(index);

        let avancement = 1;
        if (animation && animation.type === 'revelation') {
            avancement = (temps - animation.debut) / DUREE_REVELATION;
            if (avancement < 0) {
                dessinerCouvercle(x, y, index);   // pas encore son tour
                return;
            }
            if (avancement >= 1) animations.delete(index);
            else avancement = attenuation(Math.min(1, avancement));
        }

        if (etat === REVELEE) {
            const explosee = partie.explosee[index] === 1;

            ctx.fillStyle = explosee ? '#5a1420' : '#171e2b';
            ctx.beginPath();
            arrondi(ctx, x + 1, y + 1, CASE - 2, CASE - 2, 5);
            ctx.fill();

            if (avancement < 1) {
                // le couvercle s'efface par-dessus la case ouverte
                ctx.globalAlpha = 1 - avancement;
                dessinerCouvercle(x, y, index, 1 - avancement);
                ctx.globalAlpha = 1;
            }

            if (partie.mines[index]) {
                const eclat = animations.get(index);
                let echelleMine = 1;
                if (eclat && eclat.type === 'explosion') {
                    const t = Math.min(1, (temps - eclat.debut) / DUREE_EXPLOSION);
                    if (t >= 1) animations.delete(index);
                    echelleMine = 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.35;
                    ctx.fillStyle = `rgba(231,0,42,${0.55 * (1 - t)})`;
                    ctx.beginPath();
                    arrondi(ctx, x + 1, y + 1, CASE - 2, CASE - 2, 5);
                    ctx.fill();
                }
                const taille = CASE * echelleMine;
                dessinerMine(x - (taille - CASE) / 2, y - (taille - CASE) / 2, taille,
                    explosee ? '#ffd7dd' : '#8b95a5');
                return;
            }

            const chiffre = partie.chiffres[index];
            if (chiffre > 0) {
                ctx.globalAlpha = avancement;
                ctx.fillStyle = COULEURS_CHIFFRES[chiffre];
                ctx.font = `700 ${Math.round(CASE * 0.58)}px "SF Mono", ui-monospace, Menlo, monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(chiffre), x + CASE / 2, y + CASE / 2 + 1);
                ctx.globalAlpha = 1;
            }
            return;
        }

        dessinerCouvercle(x, y, index);

        if (etat === DRAPEAU) {
            // Un drapeau pose la ou il n'y avait pas de mine se barre en fin de partie.
            const errone = partie.statut === PERDU && !partie.mines[index];
            dessinerDrapeau(x, y, CASE, errone);
            if (errone) {
                ctx.strokeStyle = '#e7002a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + 7, y + 7);
                ctx.lineTo(x + CASE - 7, y + CASE - 7);
                ctx.stroke();
            }
        } else if (etat === DOUTE) {
            ctx.fillStyle = '#8b95a5';
            ctx.font = `700 ${Math.round(CASE * 0.54)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + CASE / 2, y + CASE / 2 + 1);
        }
    }

    function dessinerCouvercle(x, y, index, alpha = 1) {
        const enfoncee = enfoncees.has(index);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = enfoncee ? '#232c3d' : '#2b3445';
        ctx.beginPath();
        arrondi(ctx, x + 1, y + 1, CASE - 2, CASE - 2, 6);
        ctx.fill();

        if (!enfoncee) {
            // un filet clair en haut suffit a donner du relief sans imiter Windows
            ctx.strokeStyle = 'rgba(255,255,255,0.07)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 4, y + 2);
            ctx.lineTo(x + CASE - 4, y + 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------- boucle

    function dessiner(temps = performance.now()) {
        if (!partie) return false;

        ctx.fillStyle = '#090d13';
        ctx.fillRect(0, 0, largeur, hauteur);

        ctx.save();
        if (secousse > temps) {
            const force = (secousse - temps) / 260;
            ctx.translate(Math.sin(temps / 18) * 4 * force, Math.cos(temps / 15) * 3 * force);
        }
        ctx.translate(vue.x, vue.y);
        ctx.scale(vue.echelle, vue.echelle);

        for (let index = 0; index < partie.plateau.taille; index++) dessinerCase(index, temps);

        ctx.restore();
        return animations.size > 0 || secousse > temps;
    }

    return {
        vue,
        enfoncees,
        get partie() { return partie; },
        attacher(nouvelle) {
            partie = nouvelle;
            animations.clear();
            enfoncees.clear();
            ajusterVue();
        },
        redimensionner,
        ajusterVue,
        borner,
        caseSous,
        dessiner,

        animerRevelation(revelees, depart = performance.now()) {
            for (const { index, vague } of revelees) {
                animations.set(index, { type: 'revelation', debut: depart + vague * DECALAGE_VAGUE });
            }
        },
        animerExplosion(index, depart = performance.now()) {
            animations.set(index, { type: 'explosion', debut: depart });
            secousse = depart + 260;
        }
    };
}
