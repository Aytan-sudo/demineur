# Démineur

Le démineur classique et ses variantes, jouable au doigt comme à la souris,
hors ligne, sans serveur ni dépendance. Une page statique posée sur GitHub Pages.

Sa particularité : le mode **sans hasard**. Une grille n'est tirée que si elle
se termine par la seule logique. Plus de 50/50 en fin de partie, plus de clic
au jugé qui efface trois minutes de déduction. Et cette promesse tient pour
toutes les variantes, hexagones et chiffres menteurs compris.

## Jouer

- **Au doigt** — un appui creuse, un appui long pose un drapeau. Le bouton du
  bas inverse les deux pour enchaîner les drapeaux. Deux doigts pour déplacer
  la grille et zoomer.
- **À la souris** — clic gauche pour creuser, clic droit pour marquer, molette
  pour zoomer. `R` relance une partie, `H` demande un indice, `T` change de
  thème.
- **Le geste qui compte** — appuyer sur un chiffre déjà entouré de ses drapeaux
  ouvre toutes ses voisines d'un coup. Sans lui, l'expert est interminable.

## Les variantes

Elles se règlent sur trois axes indépendants, et se combinent librement : un
hexagone aux chiffres menteurs en trois vies est une partie parfaitement valable.

**Le plateau** — ce que « voisin » veut dire.

| | |
| --- | --- |
| **Carré** | les huit cases entourantes, le démineur d'origine |
| **Hexagone** | six voisines, des déductions franchement différentes |
| **Cavalier** | les chiffres comptent les mines à un saut d'échecs |
| **Bords recollés** | la grille devient un tore : plus aucun coin facile |

**Les chiffres** — ce que le nombre affiché raconte.

| | |
| --- | --- |
| **Exacts** | la vérité |
| **Menteurs** | chaque chiffre est faux de un, en plus ou en moins — jamais juste |
| **Flous** | à partir de trois, les chiffres deviennent des fourchettes |

**Le rythme** — ce qui met fin à la partie.

| | |
| --- | --- |
| **Une vie** | le démineur tel qu'on le connaît |
| **Trois vies** | une mine coûte un cœur, reste visible et neutralisée |
| **Zen** | on ne perd jamais |
| **Blitz** | compte à rebours, chaque case ouverte rend du temps |

## Les thèmes

Six palettes, dans la barre du haut ou dans les réglages — trois claires, trois
sombres. **Clair** par défaut, gris bleutés et neutres. **Papier**, crème et
encre brune. **Rose**, poudré et prune. **Sombre**, bleu nuit, pour jouer le
soir. **Nuit ambrée**, sombre mais sans lumière bleue. **Contraste**, noir franc
et couleurs saturées, lisible en plein soleil.

Dans chacune, le drapeau garde un rouge franc plutôt qu'un rouge assorti au
thème : sur un fond rosé ou crème, c'est le repère qu'on cherche du regard en
fin de partie.

Le bouton fait tourner la liste, les réglages donnent l'accès direct. Le choix
est mémorisé et posé avant le premier rendu, pour éviter le clignotement à
l'ouverture.

**La grille du jour** tire une combinaison au sort à partir de la date : la même
pour tout le monde, sans serveur, avec un résultat à partager.

Deux aides complètent le tout. L'**ampoule** montre une case dont on est sûr,
contre quinze secondes de pénalité. Et après une explosion, l'**autopsie** dit
si la mine était identifiable, s'il restait des déductions ailleurs, ou si
c'était vraiment un coup de dés.

Les records sont classés par configuration : un temps en trois vies ne concourt
pas contre un temps en une vie, et une partie gagnée avec un indice n'entre pas
au palmarès.

## Comment c'est fait

Le jeu tient en douze modules ES, chargés directement par le navigateur. Aucune
étape de compilation, aucun paquet à installer pour jouer.

```
js/board.js      qui est le voisin de qui — carré, hexagone, cavalier, tore
js/variantes.js  ce que les chiffres racontent, et ce qui finit la partie
js/solver.js     ce qu'on peut déduire d'une grille, en trois étages
js/generator.js  placement des mines, et rejet des grilles injustes
js/engine.js     les règles : révéler, marquer, accorder, gagner, perdre
js/defi.js       la grille du jour et son partage
js/hasard.js     un générateur aléatoire qu'on peut rejouer à l'identique
js/themes.js     la liste des thèmes et leur ordre
js/render.js     dessin sur canvas, zoom et déplacement
js/input.js      souris, doigt et stylet
js/storage.js    préférences et records
js/ui.js         compteurs, bandeau et dialogues
js/app.js        assemblage
```

### Pourquoi les variantes se combinent

Chaque axe est isolé dans un seul endroit du code.

Le **plateau** n'existe que sous forme d'une table de voisinage : ajouter
l'hexagone ou le cavalier, c'est ajouter une liste de déplacements dans
`board.js` — le solveur n'en sait rien et n'a pas bougé d'une ligne. La seule
contrainte dure est la réciprocité : si A voit B, B doit voir A, sans quoi un
chiffre compterait une mine que sa voisine ignore. C'est ce qui interdit un
hexagone enroulé sur un nombre impair de rangées, et `normaliser` rattrape le
cas au lieu de l'interdire dans l'interface.

Les **chiffres** ne sont pas passés au solveur comme des nombres mais comme des
ensembles de totaux possibles :

```
exacts   -> [3]        menteurs -> [2, 4]        flous -> [2, 3]
```

Une seule forme de contrainte, donc un seul solveur, qui reste exact quand les
chiffres mentent au lieu d'avoir une règle par variante.

Le **rythme** se résume à un nombre de vies et à un éventuel sablier. Le mode
zen n'est rien d'autre que `vies: Infinity` : aucune condition supplémentaire
n'a été ajoutée nulle part.

Les **thèmes**, enfin, ne vivent que dans la feuille de style : `themes.js` ne
tient que la liste et son ordre, et le canvas relit ses couleurs dans les mêmes
variables CSS que le reste de la page plutôt que d'en garder une seconde copie.
Un test compare chaque palette à celle de référence — une variable oubliée ne
provoque aucune erreur, elle laisse juste une couleur claire au milieu d'un
thème sombre, ce qui se remarque tard et se cherche longtemps.

### Le solveur

Il travaille par étages, du moins cher au plus cher, et s'arrête dès que l'un
trouve quelque chose :

1. **règle triviale** — le total ne peut valoir que zéro, ou que le nombre de
   cases en jeu ;
2. **sous-ensembles** — si les mines de A sont incluses dans B, alors B privé
   de A porte les totaux `b - a` ;
3. **énumération** — toutes les répartitions possibles sur la frontière, par
   groupes indépendants, bornées par le nombre de mines restantes. C'est cet
   étage qui résout les fins de partie où seul le compteur tranche.

Un resserrement gratuit s'ajoute à la collecte : une case révélée qui garde des
voisines fermées ne peut pas valoir zéro, puisqu'un zéro aurait ouvert sa nappe.
C'est ce qui rend les chiffres menteurs jouables — un « 1 » affiché vaut 0 ou 2,
et 0 est écarté d'office.

Le générateur s'en sert pour valider chaque grille. Une grille refusée n'est pas
jetée : il déplace une des mines responsables du blocage et retente, en rejouant
aussi le maquillage des chiffres. En pratique, les dix-huit combinaisons de
plateau et de chiffres se composent toutes en quelques millisecondes.

## Développement

```bash
npm test        # 181 vérifications, dont le noyau complet sans navigateur
npm run serve   # http://localhost:8765
```

Le noyau (plateau, variantes, solveur, générateur, règles, défi, classement) ne
touche pas au DOM : il se teste directement en Node. S'y ajoutent des
vérifications structurelles — palettes complètes, modules tous déclarés au
service worker, identifiants cherchés par l'interface bien présents dans la
page — qui attrapent les fautes qui ne lèvent aucune erreur.

## Ce qui n'est pas là

Les **mines lourdes** — des cases valant deux mines — étaient au menu et n'y
sont pas. Elles demandent des variables non binaires dans tout le solveur :
l'énumération passe de `2ⁿ` à `3ⁿ`, ce qui obligerait à réduire sa portée pour
*toutes* les variantes, y compris le démineur ordinaire. Livrer cette variante
aurait coûté de la qualité aux onze autres.

La grille est dessinée sur un canvas : elle n'est pas lisible par un lecteur
d'écran, et il n'y a pas de navigation au clavier case par case.
