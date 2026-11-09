---
name: audit-secu
description: Audit sécurité complet d'une filiale par le RSSI (à utiliser par le directeur quand le CEO demande « audit-secu … »)
---
# audit-secu

Filiale à auditer : l'argument donné par le CEO (identifiant ou demande)

Délègue à `rssi-devsecops` un audit complet (pas seulement un diff) de la filiale,
avec en tête `Filiale : <nom> — dossier <chemin>`. Rapport attendu :
`<dossier>/docs/rapports/audit-<AAAA-MM-JJ>.md`.

Présente ensuite au CEO : nombre de constats par gravité, les 3 plus graves, et
propose de créer une story corrective par constat critique ou haut (question à choix).
