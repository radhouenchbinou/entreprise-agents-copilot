// Garde de GitHub Copilot CLI et autorisations permanentes du CEO.
//   - .github/hooks/garde.json : hooks PreToolUse et SubagentStop (format compatible : mêmes noms d'outils que la garde,
//     code 2 = refus) qui appellent node siege/garde.js, pour le directeur et tous ses sous-agents ;
//   - droits/autorisations.json : règles permanentes ajoutées ou retirées par le CEO dans le Siège (commande autorisée pour
//     un rôle). Aucun agent ne peut écrire ces fichiers (garde) : seul le serveur du Siège, piloté par le CEO.
// Copilot CLI n'a pas de bac à sable réseau : la garde n'autorise que les commandes listées pour chaque rôle.
'use strict';
const fs = require('fs'), path = require('path');
const { ErreurBacklog } = require('./backlog');

const DOMAINES_BASE = [];
const TYPES = { regle: { libelle: 'Commande permanente pour un rôle', motif: /^\^.{3,200}$/ } };
const refus = m => { throw new ErreurBacklog(m); };

const fichier = racine => path.join(racine, 'droits', 'autorisations.json');
function lire(racine) {
  try { const j = JSON.parse(fs.readFileSync(fichier(racine), 'utf8')); return { liste: Array.isArray(j.liste) ? j.liste.filter(x => x.type === 'regle') : [] }; }
  catch { return { liste: [] }; }
}
function ecrireAtomique(f, contenu) { const t = f + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(t, contenu); fs.renameSync(t, f); }

const crochet = () => [{ type: 'command', bash: 'node siege/garde.js', powershell: 'node siege\\garde.js', cwd: '.', timeoutSec: 20 }];
function settings() {
  return { version: 1, _genere_par: 'node siege/droits.js — ne pas modifier à la main', hooks: { PreToolUse: crochet(), SubagentStop: crochet() } };
}
function generer(racine) { ecrireAtomique(path.join(racine, '.github', 'hooks', 'garde.json'), JSON.stringify(settings(racine), null, 2) + '\n'); }

// Règles permanentes ajoutées par le CEO pour un rôle, fusionnées dans la politique lue par la garde
function reglesEnPlus(racine) {
  const out = {}; for (const x of lire(racine).liste) (out[x.role] = out[x.role] || []).push(x.valeur);
  return out;
}
function ajouter(racine, { type = 'regle', valeur, role, motif }, roles) {
  const t = TYPES[type] || refus('Type : regle');
  valeur = String(valeur || '').trim();
  if (!t.motif.test(valeur)) refus(t.libelle + ' invalide : ' + valeur);
  if (!roles.includes(role)) refus('Rôle inconnu'); try { new RegExp(valeur); } catch { refus('Expression invalide'); }
  motif = String(motif || '').trim().slice(0, 300); if (motif.length < 10) refus('Motif obligatoire (pourquoi cette autorisation permanente)');
  const a = lire(racine);
  if (a.liste.some(x => x.valeur === valeur && x.role === role)) refus('Déjà autorisé');
  const n = { id: 'AUT-' + String(Math.max(0, ...a.liste.map(x => Number(x.id.slice(4)) || 0)) + 1).padStart(3, '0'), type, valeur, role, motif, ajoutee_le: new Date().toISOString(), par: 'CEO' };
  a.liste.push(n); ecrireAtomique(fichier(racine), JSON.stringify(a, null, 2) + '\n'); generer(racine);
  return n;
}
function retirer(racine, id) {
  const a = lire(racine), i = a.liste.findIndex(x => x.id === id); if (i < 0) refus('Autorisation introuvable');
  a.liste.splice(i, 1); ecrireAtomique(fichier(racine), JSON.stringify(a, null, 2) + '\n'); generer(racine);
}
const sandboxObligatoire = () => refus('Pas de bac à sable avec GitHub Copilot CLI : la garde fait seule le contrôle');

module.exports = { settings, generer, lire, ajouter, retirer, reglesEnPlus, sandboxObligatoire, TYPES, DOMAINES_BASE };
