// Messagerie du Siège par Microsoft Teams (activable dans Siège › Intégrations) :
//  - un message d'un collaborateur autorisé → demande DEM-… et session automatique du directeur ;
//    une personne inconnue → demande d'accès au CEO, rien n'est traité ; le CEO → consignes en réponse aux escalades ;
//  - boutons : le demandeur valide le résumé, le CEO accepte ou refuse ;
//  - prévient le CEO une fois par sujet (sur chaque canal où il est enregistré) : escalades, questions d'agents,
//    exceptions à décider, demandes d'accès ;
//  - une seule file de sessions du directeur et un seul plafond par jour, tous canaux confondus (~/.siege/messagerie.json).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const tm = require('./teams'), dem = require('./demandes'), canaux = require('./canaux');

const PAR_HEURE = 20;            // messages acceptés par collaborateur et par heure
const SESSION_MAX_MS = 10 * 60e3;
const jour = () => new Date().toISOString().slice(0, 10);
const PRIVE = () => process.env.SIEGE_PRIVE || path.join(os.homedir(), '.siege');
const F_COMMUN = () => path.join(PRIVE(), 'messagerie.json');

// Compteurs : sessions automatiques du directeur par jour et plafond
function commun() {
  try { return { sessions: {}, plafondJour: 50, ...JSON.parse(fs.readFileSync(F_COMMUN(), 'utf8')) }; }
  catch { return { sessions: {}, plafondJour: 50 }; }
}
function communModifier(fn) {
  const c = commun(); const r = fn(c);
  c.sessions = Object.fromEntries(Object.entries(c.sessions).slice(-14));
  fs.mkdirSync(PRIVE(), { recursive: true, mode: 0o700 });
  const t = F_COMMUN() + '.' + process.pid + '.tmp'; fs.writeFileSync(t, JSON.stringify(c), { mode: 0o600 }); fs.renameSync(t, F_COMMUN());
  return r;
}

const AIDE_COLLAB = 'Écrivez-moi simplement votre besoin : un bug (ce que vous faisiez, ce qui s\'est passé, ce que vous attendiez) ou une évolution. Je vous réponds ici.\n/mes : vos demandes · /nouvelle : commencer une autre demande';

class Messagerie {
  // lancer(id) → Promise : session du directeur sur une demande (par défaut : GitHub Copilot CLI en mode non interactif)
  constructor({ racine, lancer, journal = () => {}, extras = async () => [] }) {
    this.racine = racine; this.journal = journal; this.extras = extras; this.attente = []; this.enCours = null; this.recents = new Map();
    this.lancer = lancer || (id => lancerCopilot(racine, id, journal));
  }

  // ---------- Réception, commune aux canaux : ev = { de: {id, nom, username}, texte, prive, reponseA } ----------
  async message(c, ev) {
    if (!ev.prive || !ev.de) return;                       // conversations privées avec le bot seulement
    const e = c.lire(), de = ev.de, t = String(ev.texte || '').trim();
    const ceo = e.ceo && String(e.ceo.id) === String(de.id), collab = e.collaborateurs.find(x => String(x.id) === String(de.id));
    if (!ceo && !collab) return this.inconnu(c, de);
    if (!t) return c.envoyer(de.id, 'Je ne lis que le texte pour l\'instant.');
    if (ceo) return this.duCeo(c, de, t, ev.reponseA);
    const cle = c.cle(de.id);
    if (!this.rythme(cle)) return c.envoyer(de.id, 'Beaucoup de messages en peu de temps : je les traiterai un peu plus tard. Réessayez dans un moment.');
    if (t === '/start' || t === '/aide') return c.envoyer(de.id, `Bonjour ${collab.nom}, je suis le directeur de programme.\n${AIDE_COLLAB}`);
    if (t === '/mes') {
      const l = dem.lire().liste.filter(x => String(x.auteur.id) === String(cle)).slice(-10);
      return c.envoyer(de.id, l.length ? l.map(x => `${x.id} · ${x.statut}${x.ticket ? ' · ' + x.ticket : ''} · ${(x.resume || x.messages[0].texte).slice(0, 60)}`).join('\n') : 'Aucune demande pour l\'instant.');
    }
    let nouvelle = false, texte = t;
    if (t.startsWith('/nouvelle')) { nouvelle = true; texte = t.slice(9).trim(); if (!texte) { c.modifier(s => { (s.nouvelle = s.nouvelle || {})[de.id] = true; }); return c.envoyer(de.id, 'D\'accord : votre prochain message ouvrira une nouvelle demande.'); } }
    if (texte.startsWith('/')) return c.envoyer(de.id, AIDE_COLLAB);
    if (!nouvelle && (c.lire().nouvelle || {})[de.id]) { nouvelle = true; c.modifier(s => { delete s.nouvelle[de.id]; }); }
    const x = dem.recevoir({ id: cle, nom: collab.nom }, texte, { nouvelle });
    await c.envoyer(de.id, `${x.id} · Bien reçu, je regarde et je vous réponds ici.`);
    this.planifier(x.id);
  }
  async inconnu(c, de) {
    const nouveau = c.modifier(s => { if (s.enAttente.some(a => String(a.id) === String(de.id))) return false; s.enAttente.push({ ...de, date: new Date().toISOString() }); return true; });
    await c.envoyer(de.id, 'Ce bot est réservé aux équipes de l\'entreprise. Votre demande d\'accès est transmise ; vous serez prévenu quand elle sera acceptée.');
    if (nouveau) await this.auCeo(`acces:${c.nom}:${de.id}`, `Demande d'accès au ${c.libelle} du directeur : ${de.nom}${de.username ? ' (@' + de.username + ')' : ''}. À autoriser ou refuser dans Siège › Intégrations › ${c.libelle}.`);
  }
  async duCeo(c, de, t, reponseA) {
    const lie = reponseA && c.lire().fils[reponseA];
    if (lie) { dem.ceo(lie, { texte: t }); await c.envoyer(de.id, `${lie} · Consigne transmise au directeur.`); return this.planifier(lie); }
    if (t === '/demandes') {
      const l = dem.lire().liste.filter(dem.ouverte);
      return c.envoyer(de.id, l.length ? l.map(x => `${x.id} · ${x.statut} · ${x.auteur.nom} · ${(x.resume || x.messages[0].texte).slice(0, 60)}`).join('\n') : 'Aucune demande ouverte.');
    }
    return c.envoyer(de.id, 'Bonjour. Je vous écris ici quand une décision vous revient. Répondez à une de mes notifications (« DEM-… : consigne ») pour qu\'elle aille à la bonne demande. /demandes : demandes ouvertes.');
  }
  // ev = { de: id, data, repondre(texte) }
  async bouton(c, ev) {
    const r = /^([vc]):(DEM-\d{3,5}):([01])$/.exec(ev.data || ''), e = c.lire();
    if (!r || ev.de == null) return ev.repondre('Action inconnue');
    try {
      if (r[1] === 'v') { dem.validation(r[2], c.cle(ev.de), r[3] === '1'); await ev.repondre(r[3] === '1' ? 'Merci, c\'est noté.' : 'D\'accord, précisez votre besoin en message.'); }
      else {
        if (!e.ceo || String(e.ceo.id) !== String(ev.de)) return ev.repondre('Réservé au CEO');
        dem.ceo(r[2], { decision: r[3] === '1' ? 'accepte' : 'refuse' }); await ev.repondre(r[3] === '1' ? 'Accepté' : 'Refusé');
      }
      this.planifier(r[2]);
    } catch (err) { await ev.repondre(String(err.message).slice(0, 180)); }
  }
  rythme(cle) {
    const t = Date.now(), l = (this.recents.get(cle) || []).filter(x => t - x < 36e5);
    if (l.length >= PAR_HEURE) return false;
    l.push(t); this.recents.set(cle, l); return true;
  }

  // ---------- Teams : messages texte ; « oui » / « non », « accepter DEM-… », « DEM-… : consigne » ----------
  async teams(ev) {
    const c = canaux.teams, e = c.lire(), t = String(ev.texte || '').trim(), de = ev.de;
    const estCeo = e.ceo && e.ceo.id === de.id, collab = e.collaborateurs.find(x => x.id === de.id);
    const repondre = texte => c.envoyer(de.id, texte).catch(() => {});
    if (collab && /^(oui|non)\b[\s.!]*$/i.test(t)) {
      const l = dem.lire().liste.filter(x => x.auteur.id === c.cle(de.id) && x.statut === 'À valider');
      if (l.length === 1) return this.bouton(c, { de: de.id, data: `v:${l[0].id}:${/^oui/i.test(t) ? 1 : 0}`, repondre });
    }
    if (estCeo) {
      let m = /^(accepter|refuser)\s+(DEM-\d{3,5})\b/i.exec(t);
      if (m) return this.bouton(c, { de: de.id, data: `c:${m[2].toUpperCase()}:${/^accepter/i.test(m[1]) ? 1 : 0}`, repondre });
      m = /^(DEM-\d{3,5})\s*[:\-–]\s*([\s\S]+)$/i.exec(t);
      if (m) {
        const id = m[1].toUpperCase();
        try { dem.ceo(id, { texte: m[2] }); } catch (err) { return repondre(err.message); }
        await repondre(`${id} · Consigne transmise au directeur.`); return this.planifier(id);
      }
    }
    return this.message(c, { de, texte: t, prive: true, reponseA: '' });
  }

  // ---------- Sessions du directeur : une à la fois, plafond commun par jour ----------
  planifier(id) { if (!this.attente.includes(id)) this.attente.push(id); this.suivant(); }
  async suivant() {
    if (this.enCours || !this.attente.length) return;
    const k = commun(), n = k.sessions[jour()] || 0;
    if (n >= (k.plafondJour || 50)) {
      return this.auCeo(`plafond:${jour()}`, `Plafond de ${k.plafondJour} sessions automatiques du directeur atteint aujourd'hui : ${this.attente.length} demande(s) en attente (${this.attente.join(', ')}). Relevez-le dans Siège › Intégrations ou attendez demain.`);
    }
    const id = this.attente.shift();
    communModifier(s => { s.sessions[jour()] = (s.sessions[jour()] || 0) + 1; });
    this.enCours = id; this.journal(`directeur → ${id}`);
    try { await this.lancer(id); } catch (err) { this.journal(`session ${id} en échec : ${err.message}`); }
    finally { this.enCours = null; setImmediate(() => this.suivant()); }
  }

  // ---------- Notifications du CEO (une seule fois par sujet et par canal) ----------
  async auCeo(cle, texte) {
    let envoye = false;
    for (const c of canaux.TOUS) {
      const e = c.lire(); if (!c.pret() || !e.ceo || e.notifies[cle]) continue;
      try { await c.envoyer(e.ceo.id, texte); c.modifier(s => { s.notifies[cle] = new Date().toISOString(); }); envoye = true; }
      catch (err) { this.journal(`${c.libelle} : notification impossible (${err.message})`); }
    }
    return envoye;
  }
  async veille() { for (const [cle, texte] of await this.extras()) await this.auCeo(cle, texte).catch(err => this.journal('notification : ' + err.message)); }

  // ---------- Boucles ----------
  demarrer() {
    if (!this.veilleLancee) { this.veilleLancee = true; setInterval(() => this.veille(), 60e3); }
    this.demarrerTeams();
  }
  demarrerTeams() {
    if (this.boucleTeams) return; this.boucleTeams = true; let n = 0;
    const encore = async () => {
      let ok = false;
      if (canaux.teams.pret()) { try { ok = await tm.tour(ev => this.teams(ev), { listerChats: n++ % 12 === 0 }); } catch (err) { this.journal('Teams : ' + err.message); } }
      setTimeout(encore, ok ? 5e3 : 15e3);
    };
    encore();
  }
}

// Session non interactive du directeur (GitHub Copilot CLI) sur une demande : skill « demande », garde du Siège par
// .github/hooks, seules les commandes du Siège autorisées, ni écriture de fichier ni web
function lancerCopilot(racine, id, journal) {
  const copilote = require('./copilote');
  return new Promise((ok, ko) => {
    const f = path.join(PRIVE(), 'directeur-demandes.log');
    const out = fs.openSync(f, 'a');
    fs.writeSync(out, `\n=== ${new Date().toISOString()} demande ${id}\n`);
    const x = copilote.executable();
    const p = spawn(x.cmd, [...x.avant, '-p', `Utilise la skill demande pour traiter ${id}.`, '--silent', '--no-ask-user', '--trust-folder',
      '--allow-tool', 'shell(node siege/demande.js:*)', '--allow-tool', 'shell(node siege/backlog.js:*)', '--deny-tool', 'write', '--deny-tool', 'url'],
      { cwd: racine, env: { ...copilote.env(), SIEGE_RACINE: racine }, stdio: ['ignore', out, out], windowsHide: true });
    const t = setTimeout(() => { p.kill('SIGTERM'); journal(`session ${id} arrêtée après 10 min`); }, SESSION_MAX_MS);
    p.on('error', e => { clearTimeout(t); fs.closeSync(out); ko(e); });
    p.on('exit', c => { clearTimeout(t); fs.closeSync(out); c === 0 ? ok() : ko(new Error('code ' + c)); });
  });
}

module.exports = { Messagerie, lancerCopilot, commun, communModifier, PAR_HEURE };
