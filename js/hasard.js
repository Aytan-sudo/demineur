// Un generateur pseudo-aleatoire qu'on peut rejouer a l'identique.
//
// Math.random ne se seme pas : impossible de garantir que deux joueurs auront
// la meme grille du jour, ni de reproduire un test qui a echoue. mulberry32
// tient en cinq lignes, passe les tests usuels de qualite, et se seme.

export function generateurAleatoire(graine) {
    let etat = graine | 0;
    return () => {
        etat = (etat + 0x6D2B79F5) | 0;
        let melange = Math.imul(etat ^ (etat >>> 15), 1 | etat);
        melange = (melange + Math.imul(melange ^ (melange >>> 7), 61 | melange)) ^ melange;
        return ((melange ^ (melange >>> 14)) >>> 0) / 4294967296;
    };
}

// Graine stable pour un texte donne (FNV-1a) : la meme date donne toujours la
// meme grille, sur n'importe quel navigateur.
export function graineDepuis(texte) {
    let empreinte = 0x811c9dc5;
    for (let position = 0; position < texte.length; position++) {
        empreinte ^= texte.charCodeAt(position);
        empreinte = Math.imul(empreinte, 0x01000193);
    }
    return empreinte >>> 0;
}

// Tirage pondere : `choix` est une liste de [valeur, poids].
export function tirer(choix, aleatoire) {
    const total = choix.reduce((somme, [, poids]) => somme + poids, 0);
    let seuil = aleatoire() * total;
    for (const [valeur, poids] of choix) {
        seuil -= poids;
        if (seuil < 0) return valeur;
    }
    return choix[choix.length - 1][0];
}
