// Le numero de version, a un seul endroit dans le code.
//
// Il vit en realite a trois endroits — ici, dans package.json et dans le nom du
// cache de sw.js — et `tests/test-page.mjs` les compare. L'interet de l'afficher
// au bas des reglages est ailleurs : le numero vient du code reellement charge,
// donc si un vieux service worker sert encore ses fichiers, c'est le vieux
// numero qui s'affiche. On voit d'un coup d'oeil si la mise a jour est arrivee
// sur l'appareil.

export const VERSION = '1.2.1';
