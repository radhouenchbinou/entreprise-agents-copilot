---
name: notion-init
description: Brancher le backlog de l'entreprise sur Notion (bases Features et Bugs) et y importer les tickets (à utiliser par le directeur quand le CEO demande « notion-init … »)
---
# notion-init

Page Notion : l'argument donné par le CEO (identifiant ou demande)

1. `node siege/backlog.js source` : si le jeton est absent, arrête-toi et explique au CEO :
   - créer une intégration interne sur https://www.notion.so/profile/integrations (droits : lire, mettre à
     jour, insérer du contenu ; lire et insérer des commentaires) ;
   - donner son jeton via le Siège (Réglages) ou la variable `NOTION_TOKEN` ;
   - partager la page Notion avec l'intégration (••• › Connexions).
2. Si Notion est déjà configuré, demande au CEO s'il veut vraiment recréer des bases (`--force`).
3. `node siege/backlog.js notion-init "<URL>"` puis `node siege/backlog.js importer`.
4. Vérifie avec `node siege/backlog.js file` que la lecture depuis Notion fonctionne.
5. Résume au CEO : bases créées, nombre de tickets importés, et rappelle qu'il peut répondre aux questions
   des agents directement en commentaire sur les pages Notion.
