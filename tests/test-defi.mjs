import { defiDuJour, cleDuJour, texteDePartage, resumeDe } from '../js/defi.js';
import { generateurAleatoire, graineDepuis, tirer } from '../js/hasard.js';
import { counter } from './harness.mjs';

const { check, report } = counter();
console.log('\nDefi du jour\n');

// ------------------------------------------------------------------ hasard

const suite = graine => Array.from({ length: 5 }, generateurAleatoire(graine));
check('deux generateurs de meme graine donnent la meme suite',
    suite(42).join() === suite(42).join());
check('deux graines differentes divergent', suite(42).join() !== suite(43).join());
check('les tirages restent entre zero et un',
    Array.from({ length: 500 }, generateurAleatoire(7)).every(valeur => valeur >= 0 && valeur < 1));

check('la graine d\'un texte est stable',
    graineDepuis('demineur:2026-08-18') === graineDepuis('demineur:2026-08-18'));
check('deux dates voisines ne partagent pas leur graine',
    graineDepuis('demineur:2026-08-18') !== graineDepuis('demineur:2026-08-19'));

const constant = () => 0;
check('un tirage pondere respecte l\'ordre des poids',
    tirer([['a', 1], ['b', 9]], constant) === 'a');
check('un tirage pondere atteint la derniere valeur',
    tirer([['a', 1], ['b', 9]], () => 0.999) === 'b');

// ------------------------------------------------------------------- defi

const jour = new Date('2026-08-18T12:00:00');
check('la cle du jour suit la date locale', cleDuJour(jour) === '2026-08-18');

const premier = defiDuJour(jour);
const second = defiDuJour(jour);
check('le defi d\'une date donnee est toujours le meme',
    JSON.stringify(premier) === JSON.stringify(second));
check('deux jours donnent deux defis',
    JSON.stringify(defiDuJour(new Date('2026-08-19T12:00:00'))) !== JSON.stringify(premier));

check('le defi impose une grille sans hasard', premier.config.sansHasard === true);
check('le defi decrit sa recette', premier.resume.length > 0, premier.resume);

// Le defi tire ses reglages au sort : il doit passer par la normalisation,
// sinon un hexagone enroule sur neuf rangees sortirait un jour ou l'autre.
let toutesValides = true;
for (let decalage = 0; decalage < 400; decalage++) {
    const date = new Date(2026, 0, 1 + decalage, 12);
    const { config } = defiDuJour(date);
    const hexagoneBancal = config.topologie === 'hexagone' && config.enroule && config.lignes % 2 === 1;
    const cavalierEtroit = config.topologie === 'cavalier' && Math.min(config.colonnes, config.lignes) < 6;
    if (hexagoneBancal || cavalierEtroit) toutesValides = false;
}
check('aucun defi de l\'annee ne tombe sur une combinaison bancale', toutesValides);

// ---------------------------------------------------------------- partage

const partageGagne = texteDePartage({
    cle: '2026-08-18', resume: resumeDe(premier.config), gagne: true,
    temps: 222000, indices: 1, lien: 'https://exemple.test/'
});
check('le partage annonce la date en clair', partageGagne.includes('18/08/2026'), partageGagne);
check('le partage donne le temps', partageGagne.includes('3:42'), partageGagne);
check('le partage signale les indices utilises', partageGagne.includes('1 indice'));
check('le partage porte le lien', partageGagne.includes('https://exemple.test/'));

const partagePerdu = texteDePartage({
    cle: '2026-08-18', resume: 'Moyen', gagne: false, avancement: 0.62, indices: 0
});
check('une defaite se partage par son avancement', partagePerdu.includes('62 %'), partagePerdu);
check('une defaite ne pretend pas a un temps', !partagePerdu.includes('✅'));

report();
