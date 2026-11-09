// Activité de l'équipe, tirée du journal que tient la garde (~/.siege/activite.jsonl) : chaque délégation du directeur
// à un agent (outil Agent / task, mission « Filiale : … Ticket : … ») et chaque fin de sous-agent (SubagentStop).
// Indépendant du format des historiques de GitHub Copilot CLI.
'use strict';
const fs = require('fs'), fsp = fs.promises, path = require('path'), os = require('os');

const ACTIF_MS = 15 * 60e3;         // une mission commencée il y a moins de 15 min sans fin connue : « à son poste »
const DIRECTION_MS = 5 * 60e3;      // le directeur a agi il y a moins de 5 min : « travaille »
const HORIZON_MS = 7 * 864e5;
const STORY = /\b([A-Z]{3}-\d{3})\b/;
const FILIALE = /Filiale\s*:\s*([^\n—–-]+?)\s*(?:[—–-]|\n|$)/;
const PRIVE = () => process.env.SIEGE_PRIVE || path.join(os.homedir(), '.siege');
const F = () => path.join(PRIVE(), 'activite.jsonl');

// Écrit par la garde (siege/garde.js) ; le fichier est tronqué à ses 2 000 dernières lignes
function noter(e) {
  try {
    fs.mkdirSync(PRIVE(), { recursive: true, mode: 0o700 });
    fs.appendFileSync(F(), JSON.stringify({ date: new Date().toISOString(), ...e }) + '\n', { mode: 0o600 });
    if (Math.random() < 0.02) { const l = fs.readFileSync(F(), 'utf8').split('\n').filter(Boolean); if (l.length > 2000) fs.writeFileSync(F(), l.slice(-2000).join('\n') + '\n', { mode: 0o600 }); }
  } catch {}
}
const encoder = p => p.replace(/[^a-zA-Z0-9]/g, '-');
async function consigne() { return ''; }

async function lire({ maintenant = Date.now() } = {}) {
  let lignes = []; try { lignes = (await fsp.readFile(F(), 'utf8')).split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
  const missions = [], ouvertes = [];
  let derniereDirection = 0;
  for (const e of lignes) {
    const t = Date.parse(e.date); if (maintenant - t > HORIZON_MS) continue;
    if (e.evenement === 'action' && e.role === 'directeur') derniereDirection = Math.max(derniereDirection, t);
    if (e.evenement === 'mission') {
      const fil = FILIALE.exec(e.consigne || ''), sto = STORY.exec(e.consigne || '');
      const m = { id: 'm' + t + missions.length, session: e.session || '', agent: e.agent || 'agent', resume: (e.consigne || '').split('\n').find(x => x.trim() && !/^(Filiale|Ticket|Étape)\s*:/.test(x)) || '',
        filiale: fil ? fil[1].trim() : '', story: sto ? sto[1] : '', debut: t, derniere: t, fini: false };
      missions.push(m); ouvertes.push(m); derniereDirection = Math.max(derniereDirection, t);
    }
    if (e.evenement === 'fin_mission') {
      const i = ouvertes.findIndex(m => m.agent === e.agent && m.session === (e.session || '')); 
      if (i >= 0) { ouvertes[i].fini = true; ouvertes[i].derniere = t; ouvertes.splice(i, 1); }
    }
  }
  for (const m of missions) m.etat = m.fini ? 'termine' : maintenant - m.debut < ACTIF_MS ? 'au_poste' : 'interrompu';
  missions.sort((a, b) => b.derniere - a.derniere);
  const direction = !derniereDirection ? { etat: 'absent' } : { etat: maintenant - derniereDirection < DIRECTION_MS ? 'travaille' : 'attend_ceo', derniere: derniereDirection };
  return { direction, sessions: [], missions: missions.slice(0, 200) };
}

module.exports = { lire, noter, consigne, encoder };
