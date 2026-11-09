// Moteur des agents (GitHub Copilot CLI) et ses modèles, activables par le CEO.
// Réglages dans droits/moteurs.json (hors de portée des agents : droits/ est interdit en écriture) :
//   { "moteurs": { "<nom>": { "actif": bool, "modeles": { "<id>": bool }, "ajoutes": ["<id>"] } } }
// Par défaut : GitHub Copilot CLI actif avec tous ses modèles ; le CEO désactive ceux que les agents ne doivent pas utiliser.
'use strict';
const fs = require('fs'), path = require('path'), { execFile } = require('child_process');

const RACINE = () => process.env.SIEGE_RACINE || path.resolve(__dirname, '..', '..');
const F = () => path.join(RACINE(), 'droits', 'moteurs.json');
const MODELE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/;

class ErreurMoteur extends Error {}
const refus = m => { throw new ErreurMoteur(m); };

// bin : nom d'exécutable, ou { cmd, avant } (Copilot sous Windows : node + script, sans cmd.exe)
const sortie = (bin, args, ms = 15e3) => { const b = typeof bin === 'string' ? { cmd: bin, avant: [] } : bin;
  return new Promise(ok => execFile(b.cmd, [...b.avant, ...args], { timeout: ms, maxBuffer: 8 << 20, env: process.env, windowsHide: true }, (e, out) => ok(e ? null : String(out)))); };

const MOTEURS = {
  // GitHub Copilot CLI : directeur et agents. Liste des modèles tirée de l'aide (« --model … (choices: …) ») si la version
  // l'affiche ; sinon « auto » (Copilot Fusion) et les modèles que le CEO ajoute selon l'abonnement Copilot de l'entreprise
  copilot: { libelle: 'GitHub Copilot CLI', bin: () => require('./copilote').executable(), sousAgents: true,
    modeles: async bin => {
      const t = (await sortie(bin, ['--help'])) || '', m = /--model[^\n]*?\(choices:\s*([^)]+)\)/s.exec(t);
      const vus = m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]).filter(id => MODELE.test(id)) : [];
      return [{ id: 'auto', libelle: 'Auto (Copilot Fusion)', source: 'catalogue' }, ...vus.filter(id => id !== 'auto').map(id => ({ id, libelle: id, source: 'détecté' }))];
    } }
};

function lireConfig() { try { const j = JSON.parse(fs.readFileSync(F(), 'utf8')); return { moteurs: j.moteurs || {} }; } catch { return { moteurs: {} }; } }
function ecrireConfig(c) { const t = F() + '.' + process.pid + '.tmp'; fs.mkdirSync(path.dirname(F()), { recursive: true }); fs.writeFileSync(t, JSON.stringify(c, null, 2) + '\n'); fs.renameSync(t, F()); }
const reglage = (c, nom) => c.moteurs[nom] || { actif: nom === 'copilot', modeles: {}, ajoutes: [] };
const modeleActif = (r, id) => r.modeles[id] !== false;   // un modèle est actif sauf si le CEO l'a désactivé

let cache = null, cacheA = 0;
// Détection (mise en cache 10 min) : installé ?, version, modèles (catalogue ou détectés + ajoutés par le CEO), réglages
async function detecter({ forcer = false } = {}) {
  if (!forcer && cache && Date.now() - cacheA < 600e3) return fusionner(cache);
  const out = [];
  for (const [nom, m] of Object.entries(MOTEURS)) {
    const bin = m.bin(), v = await sortie(bin, ['--version']);
    out.push({ nom, libelle: m.libelle, installe: v != null, version: v ? v.trim().split('\n')[0].slice(0, 80) : '', externe: !!m.externe, sousAgents: !!m.sousAgents,
      catalogue: v != null ? await m.modeles(bin) : [] });
  }
  cache = out; cacheA = Date.now();
  return fusionner(out);
}
function fusionner(liste) {
  const c = lireConfig();
  return liste.map(m => {
    const r = reglage(c, m.nom), ids = new Set(m.catalogue.map(x => x.id));
    const modeles = [...m.catalogue, ...(r.ajoutes || []).filter(id => !ids.has(id)).map(id => ({ id, libelle: id, source: 'ajouté' }))]
      .map(x => ({ ...x, actif: modeleActif(r, x.id) }));
    return { ...m, catalogue: undefined, actif: !!r.actif && m.installe, demande: !!r.actif, modeles };
  });
}

// Un modèle (id complet ou alias) d'un moteur est-il autorisé ? (garde, outil des agents externes)
function autorise(nom, modele) {
  const c = lireConfig(), r = reglage(c, nom);
  if (!r.actif) return { ok: false, raison: `Moteur ${MOTEURS[nom] ? MOTEURS[nom].libelle : nom} désactivé par le CEO (Siège › Agents › Moteurs)` };
  if (!modele || modele === 'inherit') return { ok: true };
  const id = modele;
  return modeleActif(r, id) ? { ok: true } : { ok: false, raison: `Modèle ${id} désactivé par le CEO pour ${MOTEURS[nom] ? MOTEURS[nom].libelle : nom}` };
}

// Actions du CEO
function modifier(fn) { const c = lireConfig(); fn(c); ecrireConfig(c); }
function activerMoteur(nom, oui) { if (!MOTEURS[nom]) refus('Moteur inconnu : ' + nom); modifier(c => { c.moteurs[nom] = { ...reglage(c, nom), actif: !!oui }; }); }
function activerModele(nom, id, oui) {
  if (!MOTEURS[nom]) refus('Moteur inconnu : ' + nom); if (!MODELE.test(id || '')) refus('Modèle invalide');
  modifier(c => { const r = reglage(c, nom); c.moteurs[nom] = { ...r, modeles: { ...r.modeles, [id]: !!oui } }; });
}
function ajouterModele(nom, id) {
  if (!MOTEURS[nom]) refus('Moteur inconnu : ' + nom); id = String(id || '').trim(); if (!MODELE.test(id)) refus('Identifiant de modèle attendu (lettres, chiffres, . _ : / -)');
  modifier(c => { const r = reglage(c, nom); c.moteurs[nom] = { ...r, ajoutes: [...new Set([...(r.ajoutes || []), id])] }; });
}
function retirerModele(nom, id) { modifier(c => { const r = reglage(c, nom); const m = { ...r.modeles }; delete m[id]; c.moteurs[nom] = { ...r, modeles: m, ajoutes: (r.ajoutes || []).filter(x => x !== id) }; }); }

module.exports = { MOTEURS, detecter, autorise, activerMoteur, activerModele, ajouterModele, retirerModele, lireConfig, ErreurMoteur, MODELE };
