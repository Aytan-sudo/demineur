// Rendu de la grille sur un canvas, et rien d'autre : pas de regles ici.
//
// Pourquoi un canvas plutot que des elements DOM ? Une grille d'expert fait 480
// cases ; en DOM, chaque ouverture en nappe declenche autant de recalculs de
// style, et ca se sent sur telephone. Le canvas dessine la meme scene en un
// passage — et il rend l'hexagone possible, ce qu'une grille CSS ne fait pas.
//
// La vue (zoom et deplacement) vit ici aussi : c'est le seul endroit qui sait
// convertir un pixel d'ecran en numero de case.

import { REVELEE, DRAPEAU, DOUTE, PERDU } from './engine.js';

const CASE = 34;              // pas de la grille dans le repere du plateau
const MARGE = 10;

// Les couleurs viennent de la feuille de style : c'est elle qui porte les deux
// themes, et le canvas n'a aucune raison d'en tenir une seconde liste qui
// finirait par diverger. On relit tout a chaque changement de theme.
function lirePalette() {
    const style = getComputedStyle(document.documentElement);
    const lire = nom => style.getPropertyValue(nom).trim();

    return {
        fond: lire('--grille-fond'),
        fermee: lire('--case-fermee'),
        enfoncee: lire('--case-enfoncee'),
        ouverte: lire('--case-ouverte'),
        explosee: lire('--case-explosee'),
        mine: lire('--mine'),
        mineExplosee: lire('--mine-explosee'),
        drapeauMat: lire('--drapeau-mat'),
        rouge: lire('--rouge'),
        doute: lire('--doute'),
        indice: lire('--indice'),
        eclat: lire('--eclat-explosion'),
        chiffres: ['', ...Array.from({ length: 8 }, (_, rang) => lire(`--chiffre-${rang + 1}`))]
    };
}

const DUREE_REVELATION = 220;
const DECALAGE_VAGUE = 16;    // ms de retard par anneau : l'ouverture se deroule
const DUREE_EXPLOSION = 700;

const attenuation = t => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------- geometries

// Deux familles de formes seulement. Chacune sait ou se trouve le centre d'une
// case, quelle place occupe le plateau, comment tracer le contour et comment
// retrouver la case sous un pixel.
const RAYON_HEX = CASE / Math.sqrt(3);          // hexagone pointe en haut
const LARGEUR_HEX = Math.sqrt(3) * RAYON_HEX;   // = CASE
const PAS_HEX = 1.5 * RAYON_HEX;

const GEOMETRIES = {
    carre: {
        marge: 1.5,
        centre: (x, y) => ({ cx: MARGE + x * CASE + CASE / 2, cy: MARGE + y * CASE + CASE / 2 }),
        monde: (colonnes, lignes) => ({
            largeur: colonnes * CASE + MARGE * 2,
            hauteur: lignes * CASE + MARGE * 2
        }),
        contour(ctx, cx, cy, marge) {
            const cote = CASE - marge * 2;
            const rayon = 6;
            if (ctx.roundRect) ctx.roundRect(cx - cote / 2, cy - cote / 2, cote, cote, rayon);
            else ctx.rect(cx - cote / 2, cy - cote / 2, cote, cote);
        },
        approche: (px, py) => ({
            x: Math.floor((px - MARGE) / CASE),
            y: Math.floor((py - MARGE) / CASE)
        })
    },

    hexagone: {
        // Un hexagone inscrit dans son rayon touche ses voisins bien avant un
        // carre : sans cette gouttiere plus large, la grille devient un pave.
        marge: 2.6,
        centre: (x, y) => ({
            cx: MARGE + (x + (y % 2) * 0.5) * LARGEUR_HEX + LARGEUR_HEX / 2,
            cy: MARGE + y * PAS_HEX + RAYON_HEX
        }),
        monde: (colonnes, lignes) => ({
            largeur: (colonnes + 0.5) * LARGEUR_HEX + MARGE * 2,
            hauteur: (lignes - 1) * PAS_HEX + 2 * RAYON_HEX + MARGE * 2
        }),
        contour(ctx, cx, cy, marge) {
            const rayon = RAYON_HEX - marge;
            for (let sommet = 0; sommet < 6; sommet++) {
                const angle = (Math.PI / 3) * sommet;
                const px = cx + rayon * Math.sin(angle);
                const py = cy - rayon * Math.cos(angle);
                if (sommet === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        },
        // Les rangees se chevauchent : on part d'une estimation, puis on garde
        // le centre le plus proche parmi les candidats alentour.
        approche: (px, py) => ({
            x: Math.round((px - MARGE - LARGEUR_HEX / 2) / LARGEUR_HEX),
            y: Math.round((py - MARGE - RAYON_HEX) / PAS_HEX)
        })
    }
};

export function creerRendu(canvas) {
    const ctx = canvas.getContext('2d');
    const vue = { echelle: 1, x: 0, y: 0 };
    const animations = new Map();   // index -> { debut, type }
    const enfoncees = new Set();    // cases maintenues sous le doigt
    const soulignees = new Set();   // cases montrees par un indice

    let partie = null;
    let palette = lirePalette();
    let geometrie = GEOMETRIES.carre;
    let largeur = 0;
    let hauteur = 0;
    let secousse = 0;

    const monde = () => geometrie.monde(partie.plateau.colonnes, partie.plateau.lignes);
    const centreDe = index => geometrie.centre(
        index % partie.plateau.colonnes,
        Math.floor(index / partie.plateau.colonnes)
    );

    // Une case doit rester assez grande pour le pouce. Quand la grille ne tient
    // pas a cette taille, on ne retrecit pas davantage : le joueur fait glisser.
    const echelleMinimale = () => {
        const grossier = window.matchMedia?.('(pointer: coarse)').matches;
        return (grossier ? 30 : 22) / CASE;
    };

    function borner() {
        const { largeur: largeurMonde, hauteur: hauteurMonde } = monde();
        const etendueX = largeurMonde * vue.echelle;
        const etendueY = hauteurMonde * vue.echelle;

        vue.x = etendueX <= largeur ? (largeur - etendueX) / 2
            : Math.min(0, Math.max(largeur - etendueX, vue.x));
        vue.y = etendueY <= hauteur ? (hauteur - etendueY) / 2
            : Math.min(0, Math.max(hauteur - etendueY, vue.y));
    }

    function ajusterVue() {
        if (!partie) return;
        const { largeur: largeurMonde, hauteur: hauteurMonde } = monde();
        const ideal = Math.min(largeur / largeurMonde, hauteur / hauteurMonde);
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

    function caseSous(px, py) {
        if (!partie) return -1;
        const { colonnes, lignes } = partie.plateau;
        const mx = (px - vue.x) / vue.echelle;
        const my = (py - vue.y) / vue.echelle;
        const estimation = geometrie.approche(mx, my);

        let meilleur = -1;
        let meilleureDistance = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = estimation.x + dx;
                const y = estimation.y + dy;
                if (x < 0 || y < 0 || x >= colonnes || y >= lignes) continue;
                const { cx, cy } = geometrie.centre(x, y);
                const distance = (cx - mx) ** 2 + (cy - my) ** 2;
                if (distance < meilleureDistance) {
                    meilleureDistance = distance;
                    meilleur = y * colonnes + x;
                }
            }
        }
        // Au-dela d'un demi-pas, le doigt est tombe entre deux mondes : on
        // preferera ne rien faire plutot que de creuser une case au hasard.
        return meilleureDistance <= (CASE * 0.62) ** 2 ? meilleur : -1;
    }

    // ------------------------------------------------------------- dessins

    const tracer = (cx, cy, couleur) => {
        ctx.fillStyle = couleur;
        ctx.beginPath();
        geometrie.contour(ctx, cx, cy, geometrie.marge);
        ctx.fill();
    };

    // `pale` marque un drapeau pose la ou il n'y avait pas de mine : on le
    // decolore plutot que de lui donner sa propre paire de couleurs a maintenir
    // dans les deux themes.
    function dessinerDrapeau(cx, cy, pale) {
        const u = CASE / 34;
        const x = cx - 17 * u;
        const y = cy - 17 * u;
        ctx.globalAlpha = pale ? 0.4 : 1;
        ctx.strokeStyle = palette.drapeauMat;
        ctx.lineWidth = 2 * u;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 13 * u, y + 9 * u);
        ctx.lineTo(x + 13 * u, y + 25 * u);
        ctx.moveTo(x + 9 * u, y + 26 * u);
        ctx.lineTo(x + 21 * u, y + 26 * u);
        ctx.stroke();

        ctx.fillStyle = palette.rouge;
        ctx.beginPath();
        ctx.moveTo(x + 13 * u, y + 9 * u);
        ctx.lineTo(x + 24 * u, y + 13.5 * u);
        ctx.lineTo(x + 13 * u, y + 18 * u);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function dessinerMine(cx, cy, echelle, couleur) {
        const u = (CASE / 34) * echelle;
        ctx.strokeStyle = couleur;
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        for (let branche = 0; branche < 8; branche++) {
            const angle = (branche * Math.PI) / 4;
            ctx.moveTo(cx + Math.cos(angle) * 4 * u, cy + Math.sin(angle) * 4 * u);
            ctx.lineTo(cx + Math.cos(angle) * 10 * u, cy + Math.sin(angle) * 10 * u);
        }
        ctx.stroke();

        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(cx, cy, 6.5 * u, 0, Math.PI * 2);
        ctx.fill();

        // Reflet speculaire : blanc dans les deux themes, la mine restant
        // sombre partout.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(cx - 2 * u, cy - 2.4 * u, 1.6 * u, 0, Math.PI * 2);
        ctx.fill();
    }

    function dessinerTexte(texte, cx, cy, couleur, taille) {
        ctx.fillStyle = couleur;
        ctx.font = `700 ${Math.round(taille)}px "SF Mono", ui-monospace, Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(texte, cx, cy + 1);
    }

    function dessinerCouvercle(cx, cy, index, alpha = 1) {
        const enfoncee = enfoncees.has(index);
        ctx.globalAlpha = alpha;
        tracer(cx, cy, enfoncee ? palette.enfoncee : palette.fermee);

        if (soulignees.has(index)) {
            ctx.strokeStyle = palette.indice;
            ctx.lineWidth = 2;
            ctx.beginPath();
            geometrie.contour(ctx, cx, cy, geometrie.marge + 1.5);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function dessinerCase(index, temps) {
        const { cx, cy } = centreDe(index);
        const etat = partie.etat[index];
        const animation = animations.get(index);

        let avancement = 1;
        if (animation?.type === 'revelation') {
            avancement = (temps - animation.debut) / DUREE_REVELATION;
            if (avancement < 0) {
                dessinerCouvercle(cx, cy, index);   // pas encore son tour
                return;
            }
            if (avancement >= 1) animations.delete(index);
            else avancement = attenuation(Math.min(1, avancement));
        }

        if (etat !== REVELEE) {
            dessinerCouvercle(cx, cy, index);

            if (etat === DRAPEAU) {
                // Un drapeau pose la ou il n'y avait pas de mine se barre a la fin.
                const errone = partie.statut === PERDU && !partie.mines[index];
                dessinerDrapeau(cx, cy, errone);
                if (errone) {
                    ctx.strokeStyle = palette.rouge;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx - 9, cy - 9);
                    ctx.lineTo(cx + 9, cy + 9);
                    ctx.stroke();
                }
            } else if (etat === DOUTE) {
                dessinerTexte('?', cx, cy, palette.doute, CASE * 0.54);
            }
            return;
        }

        const explosee = partie.explosee[index] === 1;
        tracer(cx, cy, explosee ? palette.explosee : palette.ouverte);

        if (avancement < 1) {
            ctx.globalAlpha = 1 - avancement;
            dessinerCouvercle(cx, cy, index, 1 - avancement);
            ctx.globalAlpha = 1;
        }

        if (partie.mines[index]) {
            const eclat = animations.get(index);
            let grossissement = 1;
            if (eclat?.type === 'explosion') {
                const t = Math.min(1, (temps - eclat.debut) / DUREE_EXPLOSION);
                if (t >= 1) animations.delete(index);
                grossissement = 1 + Math.sin(t * Math.PI) * 0.35;
                ctx.fillStyle = `rgba(${palette.eclat}, ${0.55 * (1 - t)})`;
                ctx.beginPath();
                geometrie.contour(ctx, cx, cy, geometrie.marge);
                ctx.fill();
            }
            dessinerMine(cx, cy, grossissement, explosee ? palette.mineExplosee : palette.mine);
            return;
        }

        // Le texte affiche n'est pas toujours le chiffre : les variantes
        // « menteur » et « flou » le maquillent, la couleur suit la valeur lue.
        const libelle = partie.libelles?.[index] ?? String(partie.chiffres[index]);
        if (libelle === '0' || libelle === '') return;

        ctx.globalAlpha = avancement;
        const nominal = Math.min(8, Math.max(1, Number.parseInt(libelle, 10) || 1));
        const taille = libelle.length > 1 ? CASE * 0.36 : CASE * 0.58;
        dessinerTexte(libelle, cx, cy, palette.chiffres[nominal], taille);
        ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------- boucle

    function dessiner(temps = performance.now()) {
        if (!partie) return false;

        ctx.fillStyle = palette.fond;
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
        soulignees,
        get partie() { return partie; },

        attacher(nouvelle) {
            partie = nouvelle;
            geometrie = GEOMETRIES[nouvelle.plateau.geometrie] ?? GEOMETRIES.carre;
            animations.clear();
            enfoncees.clear();
            soulignees.clear();
            ajusterVue();
        },

        redimensionner,
        relirePalette() { palette = lirePalette(); },
        ajusterVue,
        deborde: () => {
            const { largeur: largeurMonde, hauteur: hauteurMonde } = monde();
            return largeurMonde * vue.echelle > largeur + 1
                || hauteurMonde * vue.echelle > hauteur + 1;
        },
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
