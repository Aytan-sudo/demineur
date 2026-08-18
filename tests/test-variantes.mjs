import { creerPlateau, calculerChiffres, voisinageReciproque } from '../js/board.js';
import { composerChiffres, affichageCoherent, normaliser, MODES_CHIFFRES, RYTHMES, compteARebours } from '../js/variantes.js';
import { counter, alea } from './harness.mjs';

const { check, report } = counter();
console.log('\nVariantes\n');

// ------------------------------------------------------------- affichages

const plateau = creerPlateau({ colonnes: 12, lignes: 12 });
const hasard = alea(808);
const mines = new Uint8Array(plateau.taille);
for (let index = 0; index < plateau.taille; index++) if (hasard() < 0.22) mines[index] = 1;
const chiffres = calculerChiffres(plateau, mines);

for (const mode of Object.keys(MODES_CHIFFRES)) {
    const { libelles, sommes } = composerChiffres({ plateau, chiffres, mode, aleatoire: hasard });

    check(`${mode} : la verite reste dans les totaux annonces`,
        affichageCoherent({ chiffres, sommes }));
    check(`${mode} : chaque case a un texte a afficher`,
        libelles.every(texte => typeof texte === 'string' && texte.length > 0));
    check(`${mode} : aucun total annonce ne depasse le nombre de voisines`,
        sommes.every((valeurs, index) =>
            valeurs.every(valeur => valeur >= 0 && valeur <= plateau.voisins[index].length)));
}

const exacts = composerChiffres({ plateau, chiffres, mode: 'exacts' });
check('exacts : le chiffre affiche est le chiffre vrai',
    exacts.libelles.every((texte, index) => texte === String(chiffres[index])));

const menteurs = composerChiffres({ plateau, chiffres, mode: 'menteurs', aleatoire: hasard });
check('menteurs : aucun chiffre affiche n\'est le bon',
    menteurs.libelles.every((texte, index) => Number(texte) !== chiffres[index]));
check('menteurs : un zero s\'affiche toujours un',
    menteurs.libelles.every((texte, index) => chiffres[index] !== 0 || texte === '1'));

const flous = composerChiffres({ plateau, chiffres, mode: 'flous', aleatoire: hasard });
check('flous : les petits chiffres restent nets',
    flous.libelles.every((texte, index) => chiffres[index] >= 3 || texte === String(chiffres[index])));
check('flous : les grands chiffres deviennent des fourchettes',
    flous.libelles.some(texte => texte.includes('-')));

// --------------------------------------------------------------- coherence

// `normaliser` existe pour que l'interface n'ait pas a connaitre les pieges
// geometriques : c'est ici qu'ils sont rattrapes, une fois pour toutes.
const hexagoneImpair = normaliser({
    colonnes: 9, lignes: 9, mines: 10, topologie: 'hexagone', enroule: true
});
check('un hexagone enroule est ramene a un nombre pair de rangees',
    hexagoneImpair.lignes === 8);
check('et il se recolle alors correctement',
    voisinageReciproque(creerPlateau({ ...hexagoneImpair })));

const petitCavalier = normaliser({ colonnes: 5, lignes: 5, mines: 5, topologie: 'cavalier' });
check('une grille de cavalier trop petite est agrandie',
    petitCavalier.colonnes === 6 && petitCavalier.lignes === 6);

const tropDeMines = normaliser({ colonnes: 8, lignes: 8, mines: 200, topologie: 'carre' });
check('le nombre de mines reste sous le plafond', tropDeMines.mines === 64 - 9);
check('et au moins une mine subsiste',
    normaliser({ colonnes: 8, lignes: 8, mines: 0, topologie: 'carre' }).mines === 1);

const intacte = normaliser({ colonnes: 16, lignes: 16, mines: 40, topologie: 'carre', enroule: true });
check('une configuration deja valide n\'est pas modifiee',
    intacte.colonnes === 16 && intacte.lignes === 16 && intacte.mines === 40);

// ----------------------------------------------------------------- rythmes

check('chaque rythme annonce un nombre de vies',
    Object.values(RYTHMES).every(rythme => rythme.vies >= 1));
check('le zen ne peut pas perdre de vie', RYTHMES.zen.vies === Infinity);
check('seul le blitz a un sablier',
    Object.entries(RYTHMES).filter(([, rythme]) => rythme.rebours).map(([nom]) => nom).join() === 'blitz');

const petit = compteARebours({ taille: 81, mines: 10 });
const grand = compteARebours({ taille: 480, mines: 99 });
check('une grande grille part avec plus de temps', grand.depart > petit.depart, [petit, grand]);
check('une grille dense rend plus de temps par case', grand.parCase > petit.parCase);

report();
