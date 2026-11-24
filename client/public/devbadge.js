/**
 * devbadge — pastille « DEV » affichée sur toutes les pages d'une app de développement.
 *
 * Injecté par launch.sh dans les apps lancées depuis /Users/benvari-macbook/AppsDev.
 * Source de vérité : ~/.claude/skills/launch/devbadge.js (ne pas éditer la copie
 * dans l'app : elle est réécrite à chaque /launch).
 *
 * ── Pourquoi un garde-fou côté navigateur ────────────────────────────────────
 * Le badge ne doit JAMAIS apparaître en prod. Deux protections indépendantes :
 *   1. launch.sh ne l'injecte que dans les apps de AppsDev ;
 *   2. ce script se désactive tout seul si le port n'est pas un port de dev.
 * La 2e couvre le cas où le fichier finirait committé sur main et donc cloné en
 * prod. On ne peut pas se fier à NODE_ENV / import.meta.env.DEV : la prod tourne
 * elle aussi en `npm run dev` (App Manager, notamment).
 *
 * Convention de ports : dev = port de prod + 10000 (3001 → 13001).
 * Tous les ports de prod sont < 10000, donc « port >= 10000 » ⇒ dev.
 */
(function () {
  'use strict';

  var ID = '__devbadge__';
  if (window[ID]) return; // déjà monté (HMR, double injection)

  var DEV_PORT_FLOOR = 10000;
  var port = parseInt(window.location.port, 10);

  // Pas de port explicite (:80/:443) ⇒ ce n'est pas un serveur de dev local.
  if (!port || port < DEV_PORT_FLOOR) return;

  // Échappatoire manuelle : ?nodevbadge dans l'URL, ou localStorage.
  try {
    if (window.location.search.indexOf('nodevbadge') !== -1) return;
    if (window.localStorage.getItem('devbadge:off') === '1') return;
  } catch (e) { /* localStorage bloqué : on continue */ }

  window[ID] = true;

  function mount() {
    var el = document.createElement('div');
    el.setAttribute('data-devbadge', '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Environnement de développement');

    el.textContent = '🛠 DEV · ' + port;

    // pointer-events:none → la pastille ne peut jamais intercepter un clic.
    el.style.cssText = [
      'position:fixed',
      'bottom:10px',
      'left:10px',
      'z-index:2147483647',
      'pointer-events:none',
      'padding:4px 9px',
      'border-radius:999px',
      'background:#b45309',
      'color:#fff',
      'font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.04em',
      'box-shadow:0 1px 4px rgba(0,0,0,.35)',
      'opacity:.85',
      'user-select:none',
      // Ne pas se glisser sous l'encoche / la barre d'accueil iOS.
      'margin-bottom:env(safe-area-inset-bottom,0px)'
    ].join(';');

    // Monté sur <html> et non <body> : React (App Router surtout) réconcilie le
    // contenu de <body> à l'hydratation et se plaindrait d'un nœud inattendu.
    document.documentElement.appendChild(el);
  }

  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
