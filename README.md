# J.A.R.V.I.S — Assistant IA pour lives Twitch

Un compagnon IA pour animer tes streams : un panneau d'administration pour le
configurer, et une fenêtre séparée à afficher pendant le live (utilisable
comme source navigateur dans OBS).

## Fonctionnalités

- **Panneau d'administration** (`/admin`) :
  - Choix du fournisseur IA : **OpenAI (GPT)**, **Anthropic (Claude)**,
    **Google (Gemini)**, ou **Ollama** (modèles en local, gratuit, sans clé).
  - Les clés API sont **entièrement facultatives** : sans clé, utilise
    Ollama pour tout faire tourner en local.
  - Liens directs pour générer chaque clé API.
  - Réglage de la **température** (créativité) des réponses.
  - Personnalité / prompt système de Jarvis, modifiable.
  - Choix du modèle utilisé par fournisseur.
  - Choix de la **voix** (synthèse vocale) : navigateur (gratuit), ElevenLabs
    ou OpenAI (clé payante, réaliste), ou Kokoro / Piper / Bark (gratuit,
    100% local, sans clé, sans envoyer le texte en ligne).
- **Fenêtre Jarvis** (`/jarvis`) : où "on voit Jarvis" pendant le live — pour
  l'instant un avatar minimaliste (orbe animé qui réagit : au repos, en
  réflexion, en train de parler) en attendant de définir son apparence
  définitive. Comprend une zone de saisie pour lui parler, l'historique de
  la conversation, et la lecture audio de la voix choisie dans l'admin.
  - Ajoute `?transparent=1` à l'URL pour un fond transparent (pratique
    pour une source navigateur OBS sans fond noir).
  - Parle à Jarvis au micro via un **mot d'activation** ("Jarvis") ou un
    **push-to-talk** (voir plus bas).

## Lancer avec Docker (recommandé)

```bash
docker compose up -d
```

Démarre tout d'un coup : le serveur, le client (nginx), Ollama, Kokoro et
Piper. Bark est désactivé par défaut (GPU, opt-in) :
`docker compose --profile bark up -d bark`.
Premier lancement d'Ollama : `docker compose exec ollama ollama pull llama3`.

Ouvre ensuite :
- `http://localhost:5173/admin` pour configurer Jarvis
- `http://localhost:5173/jarvis` pour la fenêtre à afficher pendant le live

Le [`tools/ptt-listener`](tools/ptt-listener) doit lui tourner nativement sur
Windows, jamais dans Docker (voir plus bas).

## Mode développement (sans Docker)

Utile pour modifier le code avec rechargement à chaud, plutôt que de
reconstruire l'image Docker à chaque changement. Prérequis : Node.js 18+.

```bash
npm install
npm run dev
```

Cela démarre :
- le serveur backend sur `http://localhost:4000`
- le frontend sur `http://localhost:5173`

Les mêmes URLs `/admin` et `/jarvis` qu'en Docker fonctionnent. En revanche,
Ollama/Kokoro/Piper ne sont pas lancés automatiquement dans ce mode : soit tu
les fais tourner nativement (voir ci-dessous), soit tu gardes leurs
conteneurs Docker actifs (`docker compose up -d ollama kokoro piper`) pendant
que le serveur/client tournent en local — les URLs par défaut
(`localhost:11434`, `:8880`, `:5001`) fonctionnent dans les deux cas.

## Utiliser Ollama (sans clé API)

1. [Télécharger Ollama](https://ollama.com/download) et l'installer.
2. Récupérer un modèle, par exemple : `ollama pull llama3`
3. Dans le panneau d'administration, sélectionner "Ollama" comme
   fournisseur (c'est le choix par défaut).

Avec Docker, Ollama tourne sur CPU par défaut (fonctionne sur n'importe
quelle machine, mais plus lent : plusieurs secondes par réponse). Si la
machine a une carte graphique **NVIDIA** et le [NVIDIA Container
Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
installé, active l'accélération GPU (bien plus rapide, sous la seconde une
fois le modèle chargé en mémoire) avec :

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

Pour que `docker compose up -d` (sans les `-f`) l'utilise automatiquement à
chaque fois sur cette machine, crée un fichier `.env` à la racine du projet
(ignoré par git, propre à chaque machine) contenant :

```
COMPOSE_FILE=docker-compose.yml;docker-compose.gpu.yml
```

Le premier message après un démarrage ou 30 minutes d'inactivité prend
quand même ~10 à 40 secondes le temps de charger le modèle en mémoire GPU
(réglable via `OLLAMA_KEEP_ALIVE` dans `docker-compose.yml`) ; tous les
messages suivants sont quasi instantanés tant que tu continues à discuter.

## Utiliser une clé API (OpenAI / Claude / Gemini)

Dans le panneau d'administration, chaque clé a un lien direct pour la
générer :

- OpenAI : https://platform.openai.com/api-keys
- Anthropic (Claude) : https://console.anthropic.com/settings/keys
- Google (Gemini) : https://aistudio.google.com/app/apikey

Colle la clé dans le champ correspondant puis enregistre. Les clés sont
stockées uniquement côté serveur, dans `server/data/settings.json` (ignoré
par git), et ne sont jamais renvoyées en clair au frontend (seuls les 4
derniers caractères sont affichés).

## Avoir une voix plus réaliste

La voix par défaut (synthèse vocale du navigateur) est gratuite mais robotique.
Pour une voix plus réaliste, dans le panneau d'administration, section
"Voix de Jarvis" :

- **ElevenLabs** (recommandé pour la meilleure qualité) : génère une clé sur
  https://elevenlabs.io/app/settings/api-keys, choisis une voix dans la
  [bibliothèque de voix](https://elevenlabs.io/app/voice-library) et colle
  son identifiant dans le champ "ID de la voix". Facturé à l'usage
  (~0,10 $ / 1000 caractères avec le modèle par défaut).
- **OpenAI** : réutilise la clé OpenAI déjà configurée plus haut, choisis
  simplement une des voix proposées (alloy, onyx, nova, etc.).

Si la voix choisie échoue (clé absente, quota dépassé…), Jarvis retombe
automatiquement sur la voix du navigateur.

## Avoir une voix locale et gratuite (Kokoro / Piper / Bark)

Ces trois moteurs tournent sur ta machine, gratuitement et sans envoyer le
texte à un service en ligne. Chacun nécessite de lancer son propre petit
serveur avant d'utiliser Jarvis (comme pour Ollama) ; renseigne ensuite son
adresse dans le panneau d'administration, section "Voix de Jarvis".

| Moteur | Ressources | Vitesse | Notes |
| --- | --- | --- | --- |
| **Piper** | CPU, très léger | Quasi temps réel | Le plus simple à faire tourner, recommandé si tu veux du gratuit fiable sans GPU. |
| **Kokoro** | CPU ou GPU, léger (~80M params) | Rapide | Bon compromis qualité/vitesse, voix française `ff_siwis`. |
| **Bark** | GPU fortement conseillé | Lent (plusieurs secondes/phrase) | Le plus expressif (rires, soupirs…) mais **partage ta carte graphique avec le jeu** — voir l'avertissement ci-dessous. |

- **Piper** : lance un serveur compatible OpenAI, par ex. avec Docker :
  `docker run -p 5000:5000 kamilkrawiec/piper-openai-tts`, puis renseigne
  `http://localhost:5000/v1` et une voix comme `fr_FR-siwis-medium` (liste
  des voix sur le [dépôt Piper](https://github.com/rhasspy/piper)).
- **Kokoro** : lance
  [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI), par ex. :
  `docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`
  (ou l'image `-gpu` avec `--gpus all` si tu as un GPU NVIDIA), puis
  renseigne `http://localhost:8880/v1`.
- **Bark** : pas de serveur officiel — utilise le script fourni dans
  [`tools/bark-server`](tools/bark-server) (voir son README pour
  l'installation et le lancement).

  ⚠️ **Bark partage ta carte graphique avec le jeu que tu streames.** S'il
  tourne sur la même GPU pendant que tu joues, attends-toi à des saccades ou
  des chutes de FPS le temps de générer chaque phrase (sur CPU seul, c'est
  encore plus lent). À réserver à des répliques ponctuelles, pas à des
  réponses automatiques en continu — si la fluidité du jeu prime, préfère
  Piper (CPU, léger) ou une voix cloud (ElevenLabs/OpenAI).

## Parler à Jarvis au micro

Deux façons de déclencher l'écoute du micro, configurables dans le panneau
d'administration (indépendantes, tu peux activer les deux) :

### Mot d'activation ("Jarvis") — recommandé

Dis « Jarvis » et il t'écoute automatiquement, sans toucher au clavier.
Tourne **entièrement dans le navigateur**, via la reconnaissance vocale
intégrée — aucun programme à installer, aucun risque de blocage Windows —
tant que l'onglet/la fenêtre Jarvis reste ouvert(e) (il peut rester en
arrière-plan).

Active-le simplement dans `/admin`, section "Mot d'activation". Seule
contrepartie : contrairement au push-to-talk, l'audio transite en continu
par le service de reconnaissance vocale du navigateur (Google pour
Chrome/Edge), pas seulement le temps d'une commande.

### Push-to-talk (touche à maintenir)

Maintiens une combinaison de touches pour parler, relâche pour envoyer.

⚠️ **Limitation importante** : une page web ne peut capter une touche que
si elle a le focus clavier — pas pendant qu'un jeu est au premier plan. Pour
que ça fonctionne globalement (comme le PTT de Discord), il faut lancer un
petit programme séparé sur ta machine, natif à Windows : voir
[`tools/ptt-listener`](tools/ptt-listener). Sur certaines machines
(notamment avec **Smart App Control** de Windows 11 activé), Windows peut
bloquer ce programme par réputation, car un décrocheur clavier global
ressemble techniquement à un logiciel malveillant — dans ce cas, préfère le
mot d'activation, qui n'a pas ce problème.

## Jarvis peut voir la fenêtre du jeu

Clique sur "🎮 Partager la fenêtre du jeu" (sur `/jarvis`, ou la petite icône
en bas à droite sur `/overlay`) et choisis la fenêtre ou l'écran à partager
dans la fenêtre que le navigateur ouvre. Une fois activé, chaque message
envoyé à Jarvis (texte, push-to-talk ou mot d'activation) inclut
automatiquement une capture fraîche de ce qui est partagé.

Ça ne fonctionne que si le fournisseur/modèle actif gère les images :

| Fournisseur | Vision ? |
| --- | --- |
| Gemini, OpenAI, Claude | Oui, avec les modèles par défaut |
| Ollama | Seulement avec un modèle multimodal (`llama3.2-vision`, `llava`...) — **pas** avec `llama3`, le modèle par défaut |

Si le fournisseur ne gère pas les images, Jarvis répond quand même (en
texte seul) plutôt que de planter, et dit clairement qu'il ne peut pas voir
plutôt que d'inventer une description.

## OBS (fenêtre Jarvis en overlay)

`/overlay` est une vue "visuel seul" de Jarvis (juste l'avatar, sans zone de
saisie ni historique) — c'est celle à utiliser comme source dans OBS. Elle
est autonome : le micro, le push-to-talk et le mot d'activation y
fonctionnent directement, pas besoin de garder `/jarvis` ouvert en même
temps (et il ne faut pas, sous peine de double réponse).

Ajoute une **source Navigateur** dans OBS pointant vers
`http://localhost:5173/overlay?transparent=1`, avec la taille souhaitée
(`&size=300` par exemple pour agrandir l'avatar).

`/jarvis` (avec la zone de texte, l'historique et les réglages de voix)
reste utile pour tester et régler Jarvis en dehors du live.

## Build de production

```bash
npm run build
npm start
```

Le serveur backend se lance alors seul ; sers le dossier `client/dist`
généré avec le serveur statique de ton choix (ou ajoute un serveur statique
dans `server/src/index.ts` si tu veux tout servir depuis un seul process).

## Vérification des mises à jour

Le panneau d'administration (`/admin`, section "Mises à jour") compare la
version tournant localement au dernier commit du dépôt GitHub configuré.
**Lecture seule** : ça ne fait jamais de `git pull` ni de redémarrage tout
seul, juste un bandeau si une nouvelle version existe, avec la commande à
lancer toi-même :

```bash
git pull
docker compose build && docker compose up -d   # si tu utilises Docker
```

Fonctionne avec un dépôt public, sans configuration supplémentaire.

Pas Git installé ? Double-clique sur [`update.bat`](update.bat) à la racine
du projet : il télécharge le ZIP de la dernière version depuis GitHub,
remplace les fichiers du code, puis relance `docker compose build` et
`docker compose up -d` tout seul — sans rien taper. Ta config
(`server/data/settings.json`) et les modèles Ollama déjà téléchargés ne sont
jamais touchés.

## Prochaines étapes possibles

- Apparence définitive de Jarvis (avatar 2D/3D, Live2D, etc.).
- Intégration du chat Twitch (déclenchement automatique de réponses).
