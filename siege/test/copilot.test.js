'use strict';
// GitHub Copilot CLI : connexion (github.com / ghe.com, jeton fin), agents générés et garde en hook du dépôt, garde au
// format Copilot (powershell, path, SIEGE_ROLE, outil Task).
const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const R = path.resolve(__dirname, '..', '..');

test('connexion Copilot : github.com ou GitHub Enterprise Cloud, jetons fins seulement', () => {
  process.env.SIEGE_PRIVE = fs.mkdtempSync(path.join(os.tmpdir(), 'siege-cop-')); delete process.env.COPILOT_GITHUB_TOKEN;
  delete require.cache[require.resolve('../lib/copilote')]; const c = require('../lib/copilote');
  assert.strictEqual(c.commandeConnexion(), 'copilot login');
  assert.throws(() => c.configurer({ connexion: 'ghe.com', hote: 'github.entreprise.fr' }), /ghe\.com/);
  c.configurer({ connexion: 'ghe.com', hote: 'https://Acme.ghe.com/' });
  assert.deepStrictEqual([c.lire(), c.commandeConnexion()], [{ connexion: 'ghe.com', hote: 'acme.ghe.com' }, 'copilot login --host acme.ghe.com']);
  assert.throws(() => c.enregistrerJeton('ghp_' + 'a'.repeat(36)), /classiques/);
  c.enregistrerJeton('github_pat_' + 'b'.repeat(40));
  const e = c.env({ PATH: '/bin', GH_TOKEN: 'ne-pas-transmettre', GITHUB_TOKEN: 'non' });
  assert.deepStrictEqual([e.COPILOT_GITHUB_TOKEN.slice(0, 11), e.GH_HOST, e.GH_TOKEN, e.GITHUB_TOKEN], ['github_pat_', 'acme.ghe.com', undefined, undefined]);
  c.oublierJeton(); c.configurer({ connexion: 'github.com' });
  assert.deepStrictEqual([c.env({}).COPILOT_GITHUB_TOKEN, c.env({}).GH_HOST], [undefined, undefined]);
});

test('agents Copilot générés : outils traduits, garde en hook du dépôt, skills du rôle', () => {
  const t = fs.readFileSync(path.join(R, '.github', 'agents', 'dev-backend.agent.md'), 'utf8');
  assert.match(t, /^---\nname: dev-backend\n/);
  assert.match(t, /tools: \[.*"edit".*"execute".*\]/);
  assert.doesNotMatch(t, /"agent"/, 'un dev ne délègue pas');
  const h = JSON.parse(fs.readFileSync(path.join(R, '.github', 'hooks', 'garde.json'), 'utf8'));
  assert.strictEqual(h.hooks.PreToolUse[0].bash, 'node siege/garde.js', 'garde au niveau du dépôt, pour le directeur et ses sous-agents');
  assert.ok(h.hooks.SubagentStop);
  assert.match(t, /- tdd-et-changement-minimal/);
  assert.ok(fs.existsSync(path.join(R, '.github', 'skills', 'passation', 'SKILL.md')));
  assert.ok(!fs.existsSync(path.join(R, '.github', 'agents', 'directeur.agent.md')));
});

test('garde au format Copilot : rôle par SIEGE_ROLE, powershell, chemin sous « path », outil Task', () => {
  const T = fs.mkdtempSync(path.join(os.tmpdir(), 'siege-copg-'));
  fs.cpSync(path.join(R, 'siege'), path.join(T, 'siege'), { recursive: true }); fs.mkdirSync(path.join(T, 'droits')); fs.mkdirSync(path.join(T, 'projets', 'api'), { recursive: true });
  fs.cpSync(path.join(R, 'droits', 'roles.json'), path.join(T, 'droits', 'roles.json'));
  const g = (tool_name, tool_input, env = {}) => spawnSync(process.execPath, [path.join(T, 'siege', 'garde.js')], { encoding: 'utf8',
    env: { ...process.env, SIEGE_PRIVE: path.join(T, 'prive'), ...env }, input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'c1', cwd: T, tool_name, tool_input }) });
  const dev = { SIEGE_ROLE: 'dev-backend' };
  assert.strictEqual(g('Write', { path: path.join(T, 'projets', 'api', 'src.js'), content: 'x' }, dev).status, 0);
  assert.strictEqual(g('Write', { path: path.join(T, 'droits', 'roles.json'), content: 'x' }, dev).status, 2);
  assert.strictEqual(g('Write', { path: path.join(T, 'projets', 'api', 'src.js'), content: 'x' }).status, 2, 'sans rôle : directeur, qui n\'écrit rien');
  assert.strictEqual(g('powershell', { command: 'node siege\\backlog.js voir API-001' }, { SIEGE_ROLE: 'qa' }).status, 0);
  assert.strictEqual(g('powershell', { command: 'Invoke-WebRequest https://exemple.fr' }, dev).status, 2);
  assert.match(g('Task', { agent_type: 'qa', prompt: 'Ticket : API-001' }).stderr, /Étape/, 'mission d\'un sous-agent Copilot sans étape refusée');
});
