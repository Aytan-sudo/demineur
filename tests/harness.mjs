// Harnais commun aux tests. Le noyau du jeu (plateau, solveur, generateur,
// regles) ne touche pas au DOM : il se teste en Node, sans navigateur.

export function counter() {
    const etat = { pass: 0, fail: 0 };
    const check = (libelle, condition, detail = '') => {
        if (condition) { etat.pass++; console.log(`  OK    ${libelle}`); }
        else { etat.fail++; console.log(`  ECHEC ${libelle} ${detail}`); }
    };
    const report = () => {
        console.log(`\n${etat.pass} reussis, ${etat.fail} echecs\n`);
        process.exit(etat.fail === 0 ? 0 : 1);
    };
    return { check, report };
}

// Generateur reproductible : un test qui echoue une fois sur cinquante ne sert
// a personne. mulberry32.
export function alea(graine) {
    let etat = graine;
    return () => {
        etat |= 0;
        etat = (etat + 0x6D2B79F5) | 0;
        let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pose des mines aux index demandes, et rend les chiffres qui vont avec.
export function grilleManuelle(plateau, indexMines, calculerChiffres) {
    const mines = new Uint8Array(plateau.taille);
    for (const index of indexMines) mines[index] = 1;
    return { mines, chiffres: calculerChiffres(plateau, mines) };
}
