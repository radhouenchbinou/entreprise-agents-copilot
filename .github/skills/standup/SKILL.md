---
name: standup
description: Point d'avancement de tout le portefeuille de filiales (à utiliser par le directeur quand le CEO demande « standup … »)
---
# standup

Fais le point d'avancement de l'entreprise, sans modifier aucun fichier.

1. `node siege/backlog.js file`, `node siege/backlog.js liste` et `node siege/backlog.js questions`.
2. Pour chaque filiale de `portfolio/filiales.md` : tickets en cours (étape, agent), bloqués (pourquoi),
   bugs ouverts par gravité, branches `feature/*` en cours (`git branch` en lecture seule).
3. Présente un tableau : filiale | en cours | bloqué | bugs ouverts | prochain ticket.
4. Signale les risques : questions sans réponse, NO-GO sécurité ouverts, contrats inter-filiales manquants,
   tickets sans critères d'acceptation.
5. Termine par ta recommandation des 3 prochaines actions, à faire valider par le CEO.
