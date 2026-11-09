# Onboarding du bureau IA — édition GitHub Copilot

Onboarder le bureau IA, c'est installer le Siège sur un poste Windows, connecter GitHub Copilot, lui déclarer vos
projets (une filiale par repo), brancher le backlog (Jira) et GitHub, puis lancer un premier circuit que vous validez
étape par étape. Microsoft Teams sert ensuite de canal entre vos collaborateurs et le directeur.

## Le parcours en un coup d'œil

Seules les étapes 1 à 5 et 9 sont nécessaires pour un premier circuit en local.

| # | Étape | Où | Obligatoire | Résultat |
| --- | --- | --- | --- | --- |
| 1 | Prérequis | Votre poste | Oui | Copilot CLI, Node 22+, Git, un poste dédié |
| 2 | Installer le Siège | PowerShell | Oui | Le Siège sur http://127.0.0.1:4848 |
| 3 | Connecter GitHub Copilot | Siège › Intégrations | Oui | github.com ou `<nom>.ghe.com`, modèles autorisés |
| 4 | Déclarer les filiales | Copilot CLI « Utilise la skill nouvelle-filiale » | Oui | Une fiche et une ligne du registre par repo |
| 5 | Brancher le backlog | Siège › Intégrations | Oui (fichiers par défaut) | Features et Bugs dans Jira, Notion ou fichiers |
| 6 | Brancher GitHub | Siège › Intégrations | Pour pousser et fusionner | App GitHub, un jeton par rôle et par repo |
| 7 | Droits, skills, autorisations | Siège › Droits | Relecture conseillée | Chaque agent n'a que les droits de son rôle |
| 8 | Microsoft Teams | Siège › Intégrations | Non | Collaborateurs et notifications du CEO |
| 9 | Premier circuit | Copilot CLI « Utilise la skill feature » | Oui | Une feature menée étape par étape |
| 10 | Routine du CEO | Siège + GitHub + Teams | — | Questions, exceptions, priorités, fusions |

## 1. Prérequis

- **GitHub Copilot CLI** : `winget install GitHub.Copilot` ou `npm install -g @github/copilot`. Votre abonnement
  Copilot (Business ou Enterprise) doit l'autoriser : l'administrateur de l'organisation active « Copilot CLI » dans
  les stratégies Copilot.
- **Node.js 22 ou plus** et **Git**.
- **Un poste ou une VM dédiés** (Windows Sandbox, Microsoft Dev Box, VM, conteneur), avec un compte sans droits
  d'administrateur. Copilot CLI n'a pas de bac à sable système : la garde du Siège filtre chaque action des agents,
  l'isolement de la machine limite le reste.
- **Vos projets** : un repo Git par filiale (par exemple un back et un front = deux filiales).
- **Facultatif** : un Jira (Cloud ou Data Center, compte administrateur pour l'initialisation) ou Notion, le droit de
  créer une App GitHub, un compte Microsoft 365 « Directeur » et une inscription d'application Entra (étape 8).

## 2. Installer le Siège

Le Siège est un dossier à part, distinct de vos projets ; ceux-ci seront clonés dans son sous-dossier `projets\`.

```powershell
git clone https://github.com/radhouenchbinou/entreprise-agents-copilot.git mon-siege; cd mon-siege
node siege\droits.js appliquer      # agents Copilot (.github\agents), skills et garde (.github\hooks) générés
cd siege; npm test; cd ..           # facultatif : les tests du Siège doivent tous passer
node siege\server.js                # le Siège sur http://127.0.0.1:4848
```

Dans un second terminal, lancez `copilot` à la racine de `mon-siege` et **faites confiance au dossier** au premier
lancement : sans elle, ni `AGENTS.md` (le règlement du directeur) ni la garde ne sont chargés. Cette session est votre
directeur de programme. Vérifiez avec `/agent` que les 9 agents du Siège sont listés.

Le Siège n'écoute que sur votre machine. Jetons, clés et données personnelles restent dans `~/.siege` (droits 600),
jamais dans le dépôt.

## 3. Connecter GitHub Copilot

Dans **Siège › Intégrations › GitHub Copilot**, choisissez comme dans l'extension Copilot d'IntelliJ :

- **GitHub.com** : lancez `copilot login` une fois (navigateur, jeton dans le gestionnaire d'identification Windows) ;
- **GitHub Enterprise Cloud** : saisissez le nom (`<nom>` de `<nom>.ghe.com`), puis `copilot login --host <nom>.ghe.com` ;
- ou collez un **jeton fin** `github_pat_…` avec la permission « Copilot Requests » (les jetons classiques `ghp_…` ne
  sont pas acceptés).

Puis **Siège › Agents › Moteurs d'agents et modèles** : ajoutez les modèles de votre abonnement et désactivez ceux que
les agents ne doivent pas utiliser. `auto` laisse Copilot choisir. Le modèle de chaque agent se règle dans Siège › Agents.

## 4. Déclarer les filiales

Une filiale = un repo = une équipe d'agents (PO, devs, QA) ; les services partagés (architecte, relecteur, RSSI,
devops, rédacteur) servent toutes les filiales.

1. Clonez chaque repo dans le Siège : `git clone <url> projets\<repo>`.
2. Dans Copilot CLI : « Utilise la skill nouvelle-filiale pour <Nom> projets/<repo> ». Le directeur explore le repo en
   lecture seule (stack, commandes de build et de test), vous propose un préfixe de 3 lettres et vous montre la fiche,
   avec ce qui reste à compléter (surtout les règles métier).
3. Après votre « Valider », l'outil crée la fiche `projets/<repo>/AGENTS.md`, les dossiers `docs/backlog`, `docs/adr`,
   `docs/rapports` et la ligne du registre `portfolio/filiales.md`. Une fiche existante n'est jamais écrasée.
4. Complétez vous-même les `À COMPLÉTER` de la fiche : c'est ce que tous les agents liront avant d'agir. Les agents
   n'ont jamais le droit de modifier une fiche.

Une feature qui touche plusieurs filiales n'a pas besoin d'un repo commun : elle aura un ticket parent et un ticket par
filiale, livrés ensemble (voir étape 9).

## 5. Brancher le backlog

Le backlog a deux tableaux, **Features** et **Bugs**, ordonnés par un rang (1 = le plus urgent). Agents et directeur y
accèdent toujours par le même outil, quelle que soit la source ; tout se règle dans **Siège › Intégrations**.

| Source | Ce qu'il faut | Comment le Siège trouve ses tickets |
| --- | --- | --- |
| Fichiers locaux (par défaut) | Rien | `portfolio/features.json` et `bugs.json` |
| Jira Cloud ou Data Center | Un jeton (API Cloud + e-mail, ou jeton personnel DC) d'un compte administrateur Jira, et la clé du projet | Types Story (Features) et Bug (Bugs) portant l'étiquette `bureau-ia`, parmi tous vos tableaux |
| Notion | Une intégration interne et une page partagée avec elle | Deux bases créées par le Siège sous cette page |

Pour Jira : collez le jeton, renseignez l'adresse, le projet et l'étiquette, puis **Initialiser**. Le Siège crée les
champs « Siège ID », « Siège Statut », « Siège Étape »… s'ils manquent (rien n'est supprimé) ; un avertissement liste
ceux qu'un administrateur doit ajouter aux écrans propres au projet. L'identifiant du Siège (RES-001, BUG-001) fait foi,
la clé Jira est un lien.

Terminez par **Importer le backlog local dans la source active** si vous avez déjà des tickets en fichiers.

## 6. Brancher GitHub

Les agents agissent sur GitHub au nom d'une App de l'entreprise, avec un jeton d'une heure limité au repo de leur
mission et aux droits de leur rôle ; ils ne voient jamais ni la clé ni le jeton.

1. Indiquez d'abord l'**adresse GitHub** de l'entreprise (github.com, `https://<nom>.ghe.com` ou votre serveur GitHub
   Enterprise). Créez l'App sur `<adresse>/settings/apps/new` (ou dans l'organisation) : permissions *Contents*,
   *Pull requests* et *Commit statuses* en lecture-écriture, *Metadata* en lecture, sans webhook.
2. Installez-la **uniquement** sur les repos de vos filiales ; notez l'*App ID* et l'*Installation ID* (fin de l'URL
   d'installation), téléchargez la clé privée `.pem`.
3. Dans **Siège › Intégrations › GitHub** : App ID, Installation ID, le repo GitHub de chaque filiale, la clé (fichier
   ou copier-coller), puis **Tester la connexion**. Le test dit quels repos déclarés l'App ne voit pas encore.
4. Sur chaque repo, protégez `main` : pull request obligatoire avec **une approbation**, feux requis `agents/revue` et
   `agents/securite`.

Ensuite : les devs poussent `feature/…` ou `fix/…` et ouvrent la PR, le relecteur et le RSSI posent leurs feux, vous
approuvez la PR sur GitHub, et le devops fusionne. Pour une feature sur plusieurs repos, toutes les PR sont fusionnées
ensemble ou aucune.

## 7. Droits, skills et autorisations

Chaque agent n'a que les droits de son rôle, définis dans `droits/roles.json` et vérifiés par la garde avant chaque
action ; l'outil web est fermé. Ouvrez **Siège › Droits** une fois pour relire la matrice.

- **Skills** : chaque rôle a ses skills (user story, ADR, TDD, revue, audit sécurité, passation…). Ajoutez-y les vôtres
  par type d'agent (conventions de votre stack, règles maison) depuis Siège › Droits.
- **Exceptions** : un agent bloqué pour une action nécessaire demande une exception au directeur, qui vous la transmet ;
  vous accordez ou refusez dans le Siège, et elle se ferme d'elle-même à la fin de la tâche.
- **Autorisations permanentes** (une commande durable pour un rôle) : vous seul les ajoutez ou retirez, dans Siège ›
  Droits ; `.github/hooks` et `.github/agents` sont régénérés aussitôt.
- **Contexte propre** : chaque tâche d'agent part d'un contexte neuf, et chaque étape du directeur se fait dans une
  nouvelle session ; ce qui doit survivre passe par les fichiers et la passation sur le ticket.

## 8. Microsoft Teams (facultatif)

Vos collaborateurs écrivent au directeur sur Teams pour signaler un bug ou demander une évolution ; ils n'ont jamais
accès au Siège. Le directeur vous prévient aussi sur Teams quand une décision vous revient. Aucune adresse publique.

1. Avec votre administrateur Microsoft 365 : un compte dédié « Directeur » (licence Teams) et une inscription
   d'application Entra (*Allow public client flows* activé ; permissions déléguées `User.Read`, `Chat.ReadWrite`,
   `offline_access` ; consentement de l'administrateur).
2. Dans **Siège › Intégrations › Teams** : tenant, ID d'application, **Connecter le compte Directeur** (code
   d'appareil, à saisir sur microsoft.com/devicelogin avec ce compte), puis **Activer**.
3. Écrivez au compte Directeur dans Teams, cliquez **C'est moi, le CEO**, puis autorisez chaque collaborateur qui lui
   écrit. Un inconnu n'obtient jamais de réponse.
4. Fixez le **plafond de sessions automatiques par jour** (50 par défaut) : chaque message lance une courte session
   non interactive du directeur.

Le directeur pose ses questions, fait valider un résumé au demandeur (« oui » / « non »), vous transmet ce qui le
mérite (évolution, plusieurs filiales, sécurité, argent, doute : vous répondez « accepter DEM-… », « refuser DEM-… » ou
« DEM-… : consigne »), puis crée le ticket sans rang : c'est vous qui priorisez. Suivi dans l'onglet **Demandes**. Le
Siège doit tourner sur une machine allumée, avec Copilot CLI connecté.

## 9. Lancer le premier circuit

Dans Copilot CLI, écrivez « Utilise la skill feature » (le premier ticket de la file) ou « Utilise la skill feature pour
RES-002 » ; le bouton **Lancer** d'un ticket dans le Siège ouvre une session neuve qui fait la même chose. Chaque étape
se termine par votre décision : **Valider**, **Corriger** (avec votre remarque) ou **Arrêter**.

1. **Cadrage** : filiale(s), circuit complet ou court ; plusieurs filiales → un ticket parent et un ticket par filiale.
2. **Spécification** (PO) → **Conception** (architecte, contrat d'interface si plusieurs filiales) → **Plan de tests**
   (QA).
3. **Développement** (devs) → **Recette** (QA, un ticket Bug par anomalie).
4. **Revue de code** → **Sécurité** (GO / NO-GO) → **Livraison** (devops, après votre approbation sur GitHub) →
   **Documentation**.

Après chaque « Valider », le directeur inscrit l'étape suivante sur le ticket et s'arrête : faites `/clear` puis
« Utilise la skill feature pour <ID> » (ou **Lancer**) pour continuer dans une session neuve, ce qui économise les
requêtes. Un bug se corrige avec « Utilise la skill corriger pour BUG-001 ». Une question d'agent ou une exception met
le ticket en attente de votre réponse.

## 10. La routine du CEO

Votre rôle se limite à décider ; le reste est délégué.

| Quand | Où | Quoi |
| --- | --- | --- |
| Chaque matin | Copilot CLI « Utilise la skill standup » | Avancement de toutes les filiales |
| Dès qu'un compteur bouge | Siège (en-tête) ou Teams | Questions des agents, exceptions à décider, demandes transmises |
| À chaque étape | Copilot CLI | Valider, Corriger ou Arrêter, puis relancer |
| Quand le backlog change | Siège › Backlog ou Jira | Rangs (priorités), nouveaux tickets |
| À la livraison | GitHub | Approuver la PR (ou les PR d'une feature groupée) |
| De temps en temps | Siège › Droits et Agents | Autorisations permanentes, skills maison, modèles autorisés |

## S'entraîner sans risque : l'exemple CycloFix

Avant vos vrais projets, essayez sur CycloFix, une entreprise inventée de réparation de vélos à domicile : 3 filiales
avec un repo chacune (API, application atelier, site vitrine) et 14 features en 4 jalons, dont une livrée d'un bloc sur
deux repos.

```powershell
Copy-Item exemples\cyclofix\portfolio\filiales.md, exemples\cyclofix\portfolio\roadmap.md, exemples\cyclofix\portfolio\features.json portfolio\
New-Item -ItemType Directory -Force projets | Out-Null
foreach ($r in 'cyclofix-api','cyclofix-atelier','cyclofix-vitrine') {
  Copy-Item -Recurse exemples\cyclofix\projets\$r projets\$r
  git -C projets\$r init -q -b main; git -C projets\$r add -A; git -C projets\$r commit -qm "Fondations"
}
node siege\backlog.js file        # GRP-001 doit être le premier ticket
```

Puis « Utilise la skill feature » dans Copilot CLI. Détails dans `exemples/cyclofix/LISEZMOI.md`.
