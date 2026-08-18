// Solveur logique : que peut-on deduire d'une grille en cours, sans jamais
// regarder ou sont vraiment les mines ?
//
// Il sert a quatre choses : verifier qu'une grille se termine sans deviner (le
// generateur s'en sert pour rejeter les grilles injustes), donner un indice au
// joueur, dire apres coup si un clic perdant etait deductible, et rien de tout
// cela ne doit dependre de la variante jouee.
//
// D'ou la forme des contraintes. Une case revelee ne dit pas « il y a n mines
// autour » mais « le total fait partie de cet ensemble de valeurs » :
//
//   chiffres exacts   -> [3]
//   chiffres menteurs -> [2, 4]
//   chiffres flous    -> [2, 3]
//
// Les trois etages de deduction travaillent sur cette forme unique, du moins
// cher au plus cher, et s'arretent des que l'un trouve quelque chose :
//
//   1. Regle triviale  : le total ne peut valoir que 0, ou que le nombre de
//                        cases en jeu.
//   2. Sous-ensembles  : si les mines de A sont forcement incluses dans B,
//                        alors B prive de A porte les totaux b - a.
//   3. Enumeration     : on essaie toutes les repartitions possibles sur la
//                        frontiere. Une case minee dans zero repartition est
//                        sure ; minee dans toutes, c'est une mine. C'est ce
//                        troisieme etage qui resout les fins de partie ou seul
//                        le nombre de mines restantes tranche.

export const INCONNU = 0;
export const REVELE = 1;
export const MINE = 2;

const MAX_VARIABLES = 22;   // au-dela, l'enumeration coute plus qu'elle ne rapporte
const MAX_SOLUTIONS = 200000;

// --------------------------------------------------------------- contraintes

// Une contrainte = « parmi ces cases inconnues, le nombre de mines vaut l'une
// de ces valeurs ». On en produit une par case revelee qui touche de l'inconnu.
//
// Deux resserrements gratuits au passage. Une case revelee qui garde des
// voisines fermees ne peut pas valoir zero — un zero aurait ouvert sa nappe et
// tout le monde le verrait. Et le total residuel est borne par le nombre de
// cases encore en jeu.
function collecterContraintes({ plateau, sommes, etat }) {
    const contraintes = [];

    for (let index = 0; index < plateau.taille; index++) {
        if (etat[index] !== REVELE) continue;

        const cases = [];
        let connues = 0;
        for (const voisin of plateau.voisins[index]) {
            if (etat[voisin] === MINE) connues++;
            else if (etat[voisin] === INCONNU) cases.push(voisin);
        }
        if (cases.length === 0) continue;

        const valeurs = [];
        for (const total of sommes[index]) {
            if (total === 0) continue;                  // aurait ouvert sa nappe
            const reste = total - connues;
            if (reste >= 0 && reste <= cases.length) valeurs.push(reste);
        }
        if (valeurs.length > 0) contraintes.push({ cases, valeurs });
    }
    return contraintes;
}

const minimum = valeurs => Math.min(...valeurs);
const maximum = valeurs => Math.max(...valeurs);

function appliquerRegleTriviale(contraintes, sures, mines) {
    for (const { cases, valeurs } of contraintes) {
        if (maximum(valeurs) === 0) for (const c of cases) sures.add(c);
        else if (minimum(valeurs) === cases.length) for (const c of cases) mines.add(c);
    }
}

// Deux contraintes ne peuvent s'eclairer que si elles partagent des cases ;
// inutile de comparer toute la grille avec elle-meme.
//
// Sur des ensembles de valeurs, la difference B\A porte les totaux b - a. C'est
// une sur-approximation — toutes les combinaisons ne sont pas forcement
// realisables — mais elle ne conclut que lorsque toutes s'accordent, ce qui
// reste sur.
function appliquerSousEnsembles(contraintes, sures, mines) {
    const parCase = new Map();
    contraintes.forEach((contrainte, position) => {
        for (const c of contrainte.cases) {
            if (!parCase.has(c)) parCase.set(c, []);
            parCase.get(c).push(position);
        }
    });

    const ensembles = contraintes.map(contrainte => new Set(contrainte.cases));

    for (let a = 0; a < contraintes.length; a++) {
        const voisines = new Set();
        for (const c of contraintes[a].cases) {
            for (const position of parCase.get(c)) if (position !== a) voisines.add(position);
        }

        for (const b of voisines) {
            if (contraintes[a].cases.length >= contraintes[b].cases.length) continue;
            if (![...ensembles[a]].every(c => ensembles[b].has(c))) continue;

            const reste = contraintes[b].cases.filter(c => !ensembles[a].has(c));
            const differences = [];
            for (const valeurB of contraintes[b].valeurs) {
                for (const valeurA of contraintes[a].valeurs) {
                    const ecart = valeurB - valeurA;
                    if (ecart >= 0 && ecart <= reste.length) differences.push(ecart);
                }
            }
            if (differences.length === 0) continue;

            if (maximum(differences) === 0) for (const c of reste) sures.add(c);
            else if (minimum(differences) === reste.length) for (const c of reste) mines.add(c);
        }
    }
}

// ---------------------------------------------------------------- enumeration

// Decoupe la frontiere en groupes independants : deux cases sont dans le meme
// groupe si une chaine de contraintes les relie. Enumerer chaque groupe a part
// fait s'effondrer le cout combinatoire.
function composantes(contraintes) {
    const groupeDe = new Map();
    const groupes = [];

    for (const contrainte of contraintes) {
        const rencontres = new Set();
        for (const c of contrainte.cases) {
            if (groupeDe.has(c)) rencontres.add(groupeDe.get(c));
        }

        let cible;
        if (rencontres.size === 0) {
            cible = groupes.length;
            groupes.push({ cases: new Set(), contraintes: [] });
        } else {
            // fusionne les groupes que cette contrainte vient de relier
            const [premier, ...autres] = [...rencontres];
            cible = premier;
            for (const autre of autres) {
                for (const c of groupes[autre].cases) {
                    groupes[cible].cases.add(c);
                    groupeDe.set(c, cible);
                }
                groupes[cible].contraintes.push(...groupes[autre].contraintes);
                groupes[autre].cases.clear();
                groupes[autre].contraintes.length = 0;
            }
        }

        groupes[cible].contraintes.push(contrainte);
        for (const c of contrainte.cases) {
            groupes[cible].cases.add(c);
            groupeDe.set(c, cible);
        }
    }
    return groupes.filter(groupe => groupe.cases.size > 0);
}

// Toutes les repartitions valides d'un groupe, resumees par nombre de mines
// utilisees : pour chaque total k, combien de repartitions l'atteignent et,
// pour chacune des cases, dans combien elle est minee.
function enumererGroupe(groupe) {
    const cases = [...groupe.cases];
    if (cases.length > MAX_VARIABLES) return null;

    const rang = new Map(cases.map((c, position) => [c, position]));
    const contraintes = groupe.contraintes.map(({ cases: liste, valeurs }) => ({
        indices: liste.map(c => rang.get(c)),
        valeurs: new Set(valeurs),
        min: minimum(valeurs),
        max: maximum(valeurs)
    }));

    // Pour chaque variable, les contraintes ou elle apparait : on maintient
    // leur somme partielle au fil de la descente pour elaguer des qu'une
    // branche devient impossible, au lieu d'attendre la fin.
    const impacts = cases.map(() => []);
    contraintes.forEach((contrainte, position) => {
        for (const indice of contrainte.indices) impacts[indice].push(position);
    });

    const partiels = new Int32Array(contraintes.length);
    const restantes = Int32Array.from(contraintes, contrainte => contrainte.indices.length);

    const parCompte = new Map();
    const valeursPosees = new Uint8Array(cases.length);
    let solutions = 0;
    let deborde = false;

    const explorer = (position, poses) => {
        if (deborde) return;

        if (position === cases.length) {
            solutions++;
            if (solutions > MAX_SOLUTIONS) { deborde = true; return; }
            let stats = parCompte.get(poses);
            if (!stats) {
                stats = { solutions: 0, avecMine: new Int32Array(cases.length) };
                parCompte.set(poses, stats);
            }
            stats.solutions++;
            for (let i = 0; i < valeursPosees.length; i++) if (valeursPosees[i]) stats.avecMine[i]++;
            return;
        }

        for (const valeur of [0, 1]) {
            let possible = true;
            for (const position2 of impacts[position]) {
                partiels[position2] += valeur;
                restantes[position2]--;
                if (partiels[position2] > contraintes[position2].max) possible = false;
                else if (partiels[position2] + restantes[position2] < contraintes[position2].min) possible = false;
                else if (restantes[position2] === 0 && !contraintes[position2].valeurs.has(partiels[position2])) possible = false;
            }

            if (possible) {
                valeursPosees[position] = valeur;
                explorer(position + 1, poses + valeur);
                valeursPosees[position] = 0;
            }

            for (const position2 of impacts[position]) {
                partiels[position2] -= valeur;
                restantes[position2]++;
            }
        }
    };

    explorer(0, 0);
    return deborde ? null : { cases, parCompte };
}

// Comptes de mines atteignables en combinant plusieurs groupes.
function totauxPossibles(groupes) {
    let totaux = new Set([0]);
    for (const groupe of groupes) {
        const suivant = new Set();
        for (const base of totaux) {
            for (const compte of groupe.parCompte.keys()) suivant.add(base + compte);
        }
        totaux = suivant;
    }
    return totaux;
}

// Troisieme etage. `minesRestantes` et `inconnuesHorsFront` bornent le total :
// c'est ce qui permet de conclure « il reste une mine, elle est forcement
// la-bas » quand la logique locale ne dit plus rien.
function appliquerEnumeration(contraintes, sures, mines, contexte) {
    const groupes = composantes(contraintes).map(enumererGroupe);
    if (groupes.some(groupe => groupe === null)) return; // trop gros : on renonce

    const { minesRestantes, inconnuesHorsFront } = contexte;
    const minimumFront = Math.max(0, minesRestantes - inconnuesHorsFront);
    const valide = total => total <= minesRestantes && total >= minimumFront;

    for (let position = 0; position < groupes.length; position++) {
        const groupe = groupes[position];
        const autres = totauxPossibles(groupes.filter((_, i) => i !== position));

        // Comptes de ce groupe compatibles avec au moins une completion des autres.
        const comptesValides = [...groupe.parCompte.keys()]
            .filter(compte => [...autres].some(reste => valide(compte + reste)));
        if (comptesValides.length === 0) continue;

        for (let i = 0; i < groupe.cases.length; i++) {
            let jamais = true;
            let toujours = true;
            for (const compte of comptesValides) {
                const stats = groupe.parCompte.get(compte);
                if (stats.avecMine[i] > 0) jamais = false;
                if (stats.avecMine[i] < stats.solutions) toujours = false;
            }
            if (jamais) sures.add(groupe.cases[i]);
            else if (toujours) mines.add(groupe.cases[i]);
        }
    }

    // Les cases loin de tout chiffre : elles se decident uniquement au compte.
    if (inconnuesHorsFront > 0) {
        const totaux = [...totauxPossibles(groupes)].filter(valide);
        if (totaux.length > 0) {
            const horsFront = totaux.map(total => minesRestantes - total);
            if (horsFront.every(n => n === 0)) contexte.horsFrontSurs = true;
            else if (horsFront.every(n => n === inconnuesHorsFront)) contexte.horsFrontMines = true;
        }
    }
}

// ------------------------------------------------------------------- deduction

// Tout ce qui est certain dans l'etat courant. `etat` ne contient que ce qu'un
// joueur voit : cases revelees, mines deja identifiees, reste inconnu.
//
// `etages` borne les regles employees (1 trivial, 2 + sous-ensembles, 3 +
// enumeration). Les tests s'en servent pour verifier chaque etage isolement, et
// c'est la manette du bouton d'indice.
export function deduire({ plateau, sommes, etat, minesTotales }, etages = 3) {
    const sures = new Set();
    const mines = new Set();

    const contraintes = collecterContraintes({ plateau, sommes, etat });

    appliquerRegleTriviale(contraintes, sures, mines);
    if (sures.size === 0 && mines.size === 0 && etages >= 2) {
        appliquerSousEnsembles(contraintes, sures, mines);
    }

    if (sures.size === 0 && mines.size === 0 && etages >= 3) {
        const surFront = new Set();
        for (const contrainte of contraintes) for (const c of contrainte.cases) surFront.add(c);

        let minesConnues = 0;
        let inconnues = 0;
        for (let index = 0; index < plateau.taille; index++) {
            if (etat[index] === MINE) minesConnues++;
            else if (etat[index] === INCONNU) inconnues++;
        }

        const contexte = {
            minesRestantes: minesTotales - minesConnues,
            inconnuesHorsFront: inconnues - surFront.size,
            horsFrontSurs: false,
            horsFrontMines: false
        };
        appliquerEnumeration(contraintes, sures, mines, contexte);

        if (contexte.horsFrontSurs || contexte.horsFrontMines) {
            const cible = contexte.horsFrontSurs ? sures : mines;
            for (let index = 0; index < plateau.taille; index++) {
                if (etat[index] === INCONNU && !surFront.has(index)) cible.add(index);
            }
        }
    }

    return { sures: [...sures], mines: [...mines] };
}

// --------------------------------------------------------------- resolution

function revelerCascade(plateau, chiffres, etat, depart) {
    if (etat[depart] === REVELE) return;
    const pile = [depart];
    while (pile.length > 0) {
        const index = pile.pop();
        if (etat[index] === REVELE) continue;
        etat[index] = REVELE;
        if (chiffres[index] === 0) {
            for (const voisin of plateau.voisins[index]) {
                if (etat[voisin] !== REVELE) pile.push(voisin);
            }
        }
    }
}

// Rejoue la grille en n'employant que la logique. Renvoie `resolu: true` si
// toutes les cases sans mine ont pu etre ouvertes sans jamais tirer au sort.
//
// `etatInitial` permet de reprendre une partie en cours au lieu de partir du
// premier clic : c'est ce dont l'autopsie a besoin pour repondre « pouvais-tu
// le savoir ? ». Il doit decrire un etat que le moteur aurait pu produire — une
// case revelee a zero a forcement ses voisines ouvertes — car les contraintes
// s'appuient sur cette regularite.
//
// `chiffres` est la verite du plateau — elle ne sert qu'a propager les nappes,
// exactement comme le moteur le ferait. `sommes` est ce que le joueur lit, et
// c'est la seule chose sur laquelle on raisonne.
//
// En cas de blocage, `bloquantes` liste les cases inconnues du front : c'est la
// que le generateur ira deplacer une mine pour debloquer la situation.
export function resoudre({ plateau, chiffres, sommes, mines, depart, etatInitial = null }) {
    const etat = etatInitial ? Uint8Array.from(etatInitial) : new Uint8Array(plateau.taille);
    const minesTotales = mines.reduce((total, valeur) => total + valeur, 0);
    const valeursLues = sommes ?? Array.from(chiffres, valeur => [valeur]);

    if (depart !== undefined) revelerCascade(plateau, chiffres, etat, depart);

    const resteAOuvrir = () => {
        let compte = 0;
        for (let index = 0; index < plateau.taille; index++) {
            if (!mines[index] && etat[index] !== REVELE) compte++;
        }
        return compte;
    };

    let aRevelerEncore = resteAOuvrir();

    while (aRevelerEncore > 0) {
        const { sures, mines: deduites } = deduire({
            plateau, sommes: valeursLues, etat, minesTotales
        });
        if (sures.length === 0 && deduites.length === 0) break;

        for (const index of deduites) etat[index] = MINE;
        for (const index of sures) {
            if (etat[index] !== REVELE) revelerCascade(plateau, chiffres, etat, index);
        }
        aRevelerEncore = resteAOuvrir();
    }

    const bloquantes = [];
    if (aRevelerEncore > 0) {
        for (const contrainte of collecterContraintes({ plateau, sommes: valeursLues, etat })) {
            bloquantes.push(...contrainte.cases);
        }
    }

    return { resolu: aRevelerEncore === 0, etat, bloquantes: [...new Set(bloquantes)] };
}
