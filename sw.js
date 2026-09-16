// Service worker : rend le jeu jouable hors ligne.
//
// Le jeu tient en une trentaine de kilo-octets et n'a aucune donnee a charger :
// tout est mis en cache a l'installation. On sert ensuite reseau d'abord, cache
// en secours. Le cache-first serait plus rapide et c'est un piege : un `git
// push` resterait invisible pour tous ceux qui ont deja ouvert le jeu, jusqu'a
// ce qu'on pense a changer VERSION a la main.
//
// Le nom du cache porte exactement la version du jeu : un cache qui ne change
// pas de nom continue de servir l'ancien jeu, et rien ne le signale. Un test
// compare ce numero a celui de package.json et a celui de js/config.js.

const VERSION = 'demineur-1.2.3';
const COQUILLE = [
    './',
    'index.html',
    'commun/passeport.js',
    'commun/liaison.js',
    'commun/passeport.css',
    'css/style.css',
    'js/app.js',
    'js/config.js',
    'js/engine.js',
    'js/board.js',
    'js/solver.js',
    'js/generator.js',
    'js/variantes.js',
    'js/themes.js',
    'js/defi.js',
    'js/hasard.js',
    'js/render.js',
    'js/input.js',
    'js/son.js',
    'js/storage.js',
    'js/ui.js',
    'manifest.webmanifest',
    'assets/icon.svg',
    'assets/icon-180.png',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', evenement => {
    evenement.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(COQUILLE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', evenement => {
    evenement.waitUntil(
        caches.keys()
            .then(cles => Promise.all(cles.filter(cle => cle.startsWith('demineur-') && cle !== VERSION).map(cle => caches.delete(cle))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', evenement => {
    if (evenement.request.method !== 'GET') return;

    evenement.respondWith(
        fetch(evenement.request)
            .then(reponse => {
                if (reponse.ok) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
                }
                return reponse;
            })
            .catch(() => caches.match(evenement.request).then(cache => cache || caches.match('./')))
    );
});
