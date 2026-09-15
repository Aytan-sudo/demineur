import { cleDeClassement, compterPartiePasseport } from '../js/storage.js';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nClassement\n');

// Le nom d'un tableau de records dit exactement ce qui a ete joue : deux
// parties qui ne se ressemblent pas ne doivent jamais se retrouver comparees.
const base = {
    difficulte: 'moyen', colonnes: 16, lignes: 16, mines: 40,
    topologie: 'carre', enroule: false, chiffres: 'exacts',
    rythme: 'classique', sansHasard: true
};

check('une partie ordinaire tient en deux morceaux',
    cleDeClassement(base) === 'moyen|sh', cleDeClassement(base));

check('le mode classique se distingue du sans hasard',
    cleDeClassement({ ...base, sansHasard: false }) === 'moyen|std');

check('la forme du plateau entre dans la cle',
    cleDeClassement({ ...base, topologie: 'hexagone' }) === 'moyen|hexagone|sh');

check('les bords recolles aussi',
    cleDeClassement({ ...base, enroule: true }) === 'moyen|tore|sh');

check('la sincerite des chiffres aussi',
    cleDeClassement({ ...base, chiffres: 'menteurs' }) === 'moyen|menteurs|sh');

check('le rythme aussi',
    cleDeClassement({ ...base, rythme: 'blitz' }) === 'moyen|sh|blitz');

check('une grille personnalisee porte ses dimensions',
    cleDeClassement({ ...base, difficulte: 'perso', colonnes: 12, lignes: 7, mines: 18 })
        === 'perso-12x7-18|sh');

check('les traits s\'accumulent dans un ordre stable',
    cleDeClassement({ ...base, topologie: 'cavalier', enroule: true, chiffres: 'flous', rythme: 'vies' })
        === 'moyen|cavalier|tore|flous|sh|vies');

check('deux configurations differentes ne partagent jamais leur cle',
    new Set([
        cleDeClassement(base),
        cleDeClassement({ ...base, topologie: 'hexagone' }),
        cleDeClassement({ ...base, chiffres: 'flous' }),
        cleDeClassement({ ...base, rythme: 'zen' }),
        cleDeClassement({ ...base, difficulte: 'expert' })
    ]).size === 5);

console.log('\nPasseport\n');

// Le compteur de parties du tampon Logique : il vit dans l'espace du joueur,
// repart a zero chaque jour, et ne tourne pas en mode invite.
const coffre = new Map();
const espace = { getItem: cle => coffre.get(cle) ?? null, setItem: (cle, valeur) => coffre.set(cle, String(valeur)) };
check('en mode invite, rien n\'est compte', compterPartiePasseport('2026-09-15') === null);
for (let i = 0; i < 9; i++) compterPartiePasseport('2026-09-15', espace);
check('la dixieme partie du jour atteint dix', compterPartiePasseport('2026-09-15', espace) === 10);
check('le lendemain, on repart de un', compterPartiePasseport('2026-09-16', espace) === 1);
coffre.set('demineur.passeport', '{casse');
check('un compteur illisible repart proprement', compterPartiePasseport('2026-09-16', espace) === 1);

report();
