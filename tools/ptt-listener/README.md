# Écouteur push-to-talk pour J.A.R.V.I.S

Petit programme qui écoute une combinaison de touches **au niveau du
système** (comme le push-to-talk de Discord) et prévient le serveur
J.A.R.V.I.S quand elle est enfoncée / relâchée.

## Pourquoi un programme séparé ?

Une page web ne peut capter une touche que si elle a le focus clavier — pas
pendant que tu joues à un jeu en plein écran. Détecter une touche
**globalement**, peu importe la fenêtre active, nécessite un accès bas
niveau au clavier de Windows, que ni un navigateur ni un conteneur Docker ne
peuvent obtenir. Ce petit programme doit donc tourner **directement sur
Windows**, à côté du reste (que le serveur J.A.R.V.I.S tourne lui-même en
Docker ou pas n'a pas d'importance : ce programme lui parle simplement en
HTTP sur `localhost:4000`).

## Installation

```bash
cd tools/ptt-listener
npm install
```

## Lancement

```bash
npm start
```

Laisse-le tourner en arrière-plan pendant tes lives. Il va :
1. Récupérer la combinaison configurée dans le panneau d'administration
   (`/admin`, section "Push-to-talk") — vérifiée toutes les 5 secondes, donc
   pas besoin de le relancer après avoir changé la combinaison.
2. Prévenir le serveur (`POST /api/ptt/press` puis `/release`) quand elle est
   enfoncée puis relâchée.
3. Le serveur relaie l'info à la fenêtre Jarvis ouverte, qui active alors le
   micro le temps que tu parles.

Si aucune combinaison n'est configurée (ou si le push-to-talk est
désactivé dans l'admin), il ne fait rien.

## Notes

- Windows peut demander une autorisation antivirus au premier lancement,
  puisque ce type de programme surveille le clavier globalement.
- Le programme doit rester lancé pour que le push-to-talk fonctionne ; ferme
  simplement le terminal pour l'arrêter.
