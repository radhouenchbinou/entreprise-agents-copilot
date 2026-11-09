'use strict';
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { Agents, analyser, formater } = require('../lib/agents');
const { filiales } = require('../lib/registre');
const { lire, noter } = require('../lib/activite');

test('agents : lecture des vrais fichiers du kit', async () => {
  const l = await new Agents(path.join(__dirname, '..', '..', 'agents')).lister();
  assert.deepStrictEqual(l.filter(a => a.portee === 'filiale').map(a => a.nom).sort(), ['dev-backend', 'dev-frontend', 'product-owner', 'qa']);
  assert.ok(l.every(a => a.description && a.consigne));
});

test('agents : créer, modifier, refuser les noms et outils invalides, supprimer', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-')), ag = new Agents(d);
  const a = { nom: 'data-engineer', description: 'Pipelines\nde données', modele: 'sonnet', outils: ['Read', 'Bash'], consigne: 'Tu es data engineer.' };
  await ag.ecrire(a, { creation: true });
  assert.match(fs.readFileSync(path.join(d, 'data-engineer.md'), 'utf8'), /^---\nname: data-engineer\ndescription: Pipelines de données\ntools: Read, Bash\nmodel: sonnet\n---\n/);
  await assert.rejects(ag.ecrire(a, { creation: true }), /déjà/);
  await assert.rejects(ag.ecrire({ ...a, nom: '../x' }, { creation: true }), /Nom/);
  await assert.rejects(ag.ecrire({ ...a, outils: ['rm'] }, { creation: false }), /Outil/);
  await ag.ecrire({ ...a, modele: 'opus' }, { creation: false });
  assert.strictEqual((await ag.lister())[0].modele, 'opus');
  await ag.supprimer('data-engineer');
  assert.deepStrictEqual(await ag.lister(), []);
  assert.deepStrictEqual(analyser(formater(a), 'x.md').outils, ['Read', 'Bash']);
});

test('registre des filiales : lignes du tableau, préfixes à 3 lettres seulement', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'filiales.md');
  fs.writeFileSync(f, '# Registre\n\n| Filiale | Préfixe | Dossier | Repo git | Statut |\n|---|---|---|---|---|\n| Collecte | COL | `projets/x/collecte` | `projets/x` | Active |\n| Groupe | GRP | `portfolio` | — | Transverse |\n| Mauvaise | TROP | `y` | | |\n');
  assert.deepStrictEqual((await filiales(f)).map(x => [x.nom, x.prefixe, x.dossier, x.repo]), [['Collecte', 'COL', 'projets/x/collecte', 'projets/x'], ['Groupe', 'GRP', 'portfolio', '—']]);
});

test('activité : journal de la garde, missions des sous-agents et état du directeur', async () => {
  process.env.SIEGE_PRIVE = fs.mkdtempSync(path.join(os.tmpdir(), 'act-'));
  noter({ evenement: 'mission', session: 's1', agent: 'qa', consigne: 'Filiale : Réservations — dossier projets/cyclofix-api\nTicket : RES-002\nMode recette' });
  noter({ evenement: 'mission', session: 's1', agent: 'reviewer', consigne: 'Filiale : Réservations — dossier x\nTicket : RES-001' });
  noter({ evenement: 'fin_mission', session: 's1', agent: 'reviewer' });
  let r = await lire();
  assert.strictEqual(r.direction.etat, 'travaille');
  const qa = r.missions.find(m => m.agent === 'qa'), rv = r.missions.find(m => m.agent === 'reviewer');
  assert.deepStrictEqual([qa.filiale, qa.story, qa.etat, qa.resume], ['Réservations', 'RES-002', 'au_poste', 'Mode recette']);
  assert.strictEqual(rv.etat, 'termine');
  r = await lire({ maintenant: Date.now() + 20 * 60e3 });
  assert.strictEqual(r.direction.etat, 'attend_ceo');
  assert.strictEqual(r.missions.find(m => m.agent === 'qa').etat, 'interrompu');
  delete process.env.SIEGE_PRIVE;
});
