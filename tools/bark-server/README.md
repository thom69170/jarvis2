# Serveur Bark pour J.A.R.V.I.S

Petit serveur Python qui expose [Bark](https://github.com/suno-ai/bark) (le
modèle de synthèse vocale de Suno) via une API compatible OpenAI, pour que
J.A.R.V.I.S puisse l'utiliser comme option de voix locale et gratuite.

## ⚠️ Avant d'installer : impact sur les performances en jeu

Bark tourne sur le GPU (CUDA) quand il est disponible. Si tu joues **et**
streames sur la **même carte graphique**, chaque phrase générée par Jarvis
peut provoquer une saccade ou une chute de FPS dans le jeu le temps de la
génération. Sur CPU seul, la génération est encore plus lente (plusieurs
secondes, parfois beaucoup plus, par phrase) — inutilisable pour des
réactions en temps réel à un chat actif.

**Recommandation** : réserve Bark à des répliques ponctuelles et courtes,
pas à des réponses automatiques à chaque message du chat. Si la fluidité du
jeu est prioritaire, préfère ElevenLabs ou OpenAI (voix dans le cloud, aucun
impact sur ta carte graphique) ou Piper (beaucoup plus léger, fonctionne
bien sur CPU).

## Installation

Prérequis : Python 3.10+, et idéalement un GPU NVIDIA avec CUDA pour des
temps de génération raisonnables.

```bash
cd tools/bark-server
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Le premier lancement télécharge les modèles Bark (environ 5 Go).

## Lancement

```bash
python server.py
```

Le serveur écoute par défaut sur `http://localhost:8882`. Dans le panneau
d'administration de J.A.R.V.I.S (section "Voix de Jarvis"), sélectionne
"Bark" et renseigne `http://localhost:8882/v1` comme adresse du serveur.

## Voix disponibles

Bark utilise des "presets" de voix, par exemple `v2/fr_speaker_0` à
`v2/fr_speaker_9` pour le français (`v2/en_speaker_0`... pour l'anglais,
etc.). La liste complète est dans le
[dépôt officiel](https://github.com/suno-ai/bark/tree/main/bark/assets/prompts/v2).
