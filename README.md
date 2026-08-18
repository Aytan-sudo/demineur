# Démineur

Le démineur classique, jouable au doigt comme à la souris, hors ligne, sans
serveur ni dépendance. Une page statique posée sur GitHub Pages.

Sa particularité : le mode **sans hasard**. Une grille n'est tirée que si elle
se termine par la seule logique. Plus de 50/50 en fin de partie, plus de clic
au jugé qui efface trois minutes de déduction.

## Jouer

- **Au doigt** — un appui creuse, un appui long pose un drapeau. Le bouton du
  bas inverse les deux pour enchaîner les drapeaux. Deux doigts pour déplacer
  la grille et zoomer.
- **À la souris** — clic gauche pour creuser, clic droit pour marquer, molette
  pour zoomer.
- **Le geste qui compte** — appuyer sur un chiffre déjà entouré de ses drapeaux
  ouvre toutes ses voisines d'un coup. Sans lui, l'expert est interminable.

## Variantes

Deux sont livrées, activables dans les réglages :

| Variante | Effet |
| --- | --- |
| **Sans hasard** | La grille est rejetée tant qu'un solveur ne la termine pas par pure logique. Activée par défaut. |
| **Trois vies** | Une mine coûte un cœur au lieu de finir la partie. La mine sautée reste visible et neutralisée. |

Les records sont classés par configuration : un temps en trois vies ne concourt
pas contre un temps en une seule vie.

## Comment c'est fait

Le jeu tient en huit modules ES, chargés directement par le navigateur. Aucune
étape de compilation, aucun paquet à installer pour jouer.

```
js/board.js      qui est le voisin de qui
js/solver.js     ce qu'on peut déduire d'une grille, en trois étages
js/generator.js  placement des mines, et rejet des grilles injustes
js/engine.js     les règles : révéler, marquer, accorder, gagner, perdre
js/render.js     dessin sur canvas, zoom et déplacement
js/input.js      souris, doigt et stylet
js/storage.js    préférences et records
js/ui.js         compteurs et dialogues
js/app.js        assemblage
```

Les règles sont découpées en trois axes indépendants, pensés pour que les
variantes se combinent au lieu de s'exclure :

- **le plateau** — la table de voisinage, seul endroit à toucher pour une
  grille hexagonale, torique ou à voisinage de cavalier (le tore est déjà
  implémenté et testé, il n'est simplement pas proposé dans l'interface) ;
- **les chiffres** — ce que le nombre affiché raconte (exact aujourd'hui ;
  menteur ou approximatif demain) ;
- **le rythme** — les conditions de défaite et le temps (une vie, trois vies,
  zen, chrono inversé).

Le solveur mérite un mot. Il travaille par étages, du moins cher au plus cher,
et s'arrête dès que l'un trouve quelque chose :

1. **règle triviale** — un 2 avec deux cases inconnues : deux mines ;
2. **sous-ensembles** — si les mines de A sont incluses dans B, alors B privé
   de A contient exactement `b - a` mines ;
3. **énumération** — toutes les répartitions possibles sur la frontière, par
   groupes indépendants, bornées par le nombre de mines restantes. C'est cet
   étage qui résout les fins de partie où seul le compteur tranche.

Le générateur s'en sert pour valider chaque grille. Une grille refusée n'est pas
jetée : il déplace une des mines responsables du blocage et retente. Repartir de
zéro fonctionne aussi, mais converge beaucoup moins vite. En pratique une grille
d'expert garantie sans hasard se compose en quelques millisecondes.

## Développement

```bash
npm test        # 71 vérifications sur le noyau, sans navigateur
npm run serve   # http://localhost:8765
```

Le noyau (plateau, solveur, générateur, règles) ne touche pas au DOM : il se
teste directement en Node.

## Limites connues

La grille est dessinée sur un canvas : elle n'est pas lisible par un lecteur
d'écran, et il n'y a pas encore de navigation au clavier case par case.
