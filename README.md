# 👻 Horror Story Generator

Générateur automatique de vidéos d'histoires d'horreur depuis Reddit avec narration et illustrations générées par IA.

## 🎬 Fonctionnalités

- ✅ Récupération aléatoire d'histoires depuis r/scarystories
- ✅ Génération de narration vocale IA (Google TTS ou ElevenLabs)
- ✅ Création d'images d'horreur avec DALL-E ou images placeholder
- ✅ Montage vidéo automatique avec FFmpeg
- ✅ Interface web moderne et responsive
- ✅ Téléchargement des vidéos générées

## 📋 Prérequis

### Logiciels requis

1. **Node.js** (version 18 ou supérieure)
   - Télécharger: https://nodejs.org/

2. **FFmpeg** (pour le montage vidéo)
   - Windows: Télécharger depuis https://ffmpeg.org/download.html
   - Ou installer avec Chocolatey: `choco install ffmpeg`
   - Ajouter FFmpeg au PATH système

### Clés API (optionnelles mais recommandées)

1. **Reddit API** (pour accéder aux vraies histoires)
   - Créer une application sur https://www.reddit.com/prefs/apps
   - Type: "script"
   - Obtenir: Client ID et Client Secret

2. **OpenAI API** (pour générer de vraies images)
   - Créer un compte sur https://platform.openai.com/
   - Générer une clé API: https://platform.openai.com/api-keys
   - Crédits requis pour DALL-E 3

3. **ElevenLabs API** (optionnel, pour une meilleure voix)
   - Créer un compte sur https://elevenlabs.io/
   - Obtenir une clé API depuis le dashboard

> **Note:** Le projet fonctionne sans ces clés avec des données de démonstration et images placeholder.

## 🚀 Installation

### 1. Cloner ou télécharger le projet

```powershell
cd "C:\Users\Kowiz\OneDrive\Documents\Horror Story"
```

### 2. Installer les dépendances

```powershell
npm install
```

### 3. Configuration

Copier le fichier `.env.example` vers `.env`:

```powershell
Copy-Item .env.example .env
```

Éditer le fichier `.env` avec vos clés API:

```env
# Configuration Reddit API
REDDIT_CLIENT_ID=votre_client_id
REDDIT_CLIENT_SECRET=votre_client_secret
REDDIT_USER_AGENT=horror-story-bot/1.0

# Configuration OpenAI (pour DALL-E)
OPENAI_API_KEY=votre_cle_openai

# Configuration ElevenLabs (optionnel)
ELEVENLABS_API_KEY=votre_cle_elevenlabs

# Configuration serveur
PORT=3000
```

### 4. Créer les dossiers nécessaires

```powershell
New-Item -ItemType Directory -Force -Path videos, images, audio
```

## 🎮 Utilisation (mode sans serveur)

Vous pouvez utiliser le projet entièrement côté navigateur, sans serveur Node.

### Ouvrir l'application

1. Ouvrez le fichier `public/index.html` dans votre navigateur (double-clic)
2. Cliquez sur "Lire une histoire et la narrer"
3. L'application :
   - Récupère une histoire aléatoire depuis r/scarystories
   - Lance la narration via la voix IA du navigateur (Web Speech)
   - Affiche un diaporama de scènes dans un canvas

### Enregistrement vidéo (expérimental)

- Bouton "Enregistrer en WebM": enregistre le diaporama (sans la voix TTS)
- Inclut un léger fond audio généré (WebAudio) pour la piste audio
- Sortie: fichier `.webm` téléchargeable (compatibilité Chrome/Edge)

> Limitation: La voix Web Speech est jouée en direct et n'est pas incluse dans le fichier vidéo. Pour une vidéo `.mp4` avec voix incluse, passez au mode serveur.

## 🌐 Déploiement GitHub Pages (recommandé)

Ce projet peut être publié via GitHub Pages depuis le **dossier racine** (avec `index.html` à la source), ou via le **dossier `docs/`**.

1. Initialisez le dépôt local et créez la branche principale:
   ```powershell
   git init
   git add .
   git commit -m "Client-only Horror Story + terminal + docs"
   git branch -M main
   ```
2. Créez un dépôt sur GitHub (public) via l'interface web.
3. Ajoutez le remote et poussez:
   ```powershell
   git remote add origin https://github.com/<votre_user>/<votre_repo>.git
   git push -u origin main
   ```
4. Activez GitHub Pages (choisissez l'une des options):
   - Option A (racine): Branch `main`, Dossier: `/root` (le dépôt racine)
   - Option B (`docs/`): Branch `main`, Dossier: `/docs`

Votre site sera publié à: `https://<votre_user>.github.io/<votre_repo>/`.

## 🛠️ Structure du projet

```
Horror Story/
├── public/                 # Frontend
│   ├── index.html         # Interface utilisateur
│   ├── styles.css         # Styles CSS
│   └── app.js             # Logique frontend
├── services/              # Services backend
│   ├── redditService.js   # Récupération histoires Reddit
│   ├── ttsService.js      # Génération voix (TTS)
│   ├── imageService.js    # Génération images IA
│   └── videoService.js    # Montage vidéo FFmpeg
├── routes/                # Routes API
│   └── storyRoutes.js     # Endpoints API
├── videos/                # Vidéos générées
├── images/                # Images générées
├── audio/                 # Fichiers audio
├── server.js              # Serveur Express
├── package.json           # Dépendances
├── .env                   # Configuration (à créer)
└── README.md             # Ce fichier
```

## 🔁 Mode serveur (optionnel)

Si vous voulez une **vidéo `.mp4` téléchargeable avec voix IA incluse**, utilisez le serveur Node (Express + FFmpeg). Voir plus haut les prérequis et exécuter:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" start
```

## ⚙️ Configuration avancée

### Modifier le nombre de scènes

Dans [services/redditService.js](services/redditService.js#L60), modifier:
```javascript
splitIntoScenes(text, maxScenes = 5)  // Changer le nombre
```

### Modifier la durée par image

Dans [services/videoService.js](services/videoService.js#L20), modifier:
```javascript
const secondsPerImage = 5;  // Durée en secondes
```

### Changer la voix TTS

Dans [services/ttsService.js](services/ttsService.js#L32), modifier le voiceId ElevenLabs.

## 🐛 Dépannage

### FFmpeg non trouvé
```
Error: Cannot find ffmpeg
```
**Solution:** Installer FFmpeg et l'ajouter au PATH système

### Erreur API Reddit
```
Error: Invalid credentials
```
**Solution:** Vérifier les identifiants Reddit dans `.env`

### Génération d'images échoue
**Solution:** Le système utilise automatiquement des images placeholder. Pour de vraies images, configurer OpenAI API.

### Port déjà utilisé
```
Error: Port 3000 already in use
```
**Solution:** Changer le PORT dans `.env` ou arrêter l'autre application

### Problème de mémoire
**Solution:** Réduire le nombre de scènes ou la taille des images

## 📝 Limitations

- Les vidéos peuvent prendre 1-5 minutes à générer
- Limite de longueur de texte pour TTS (5000 caractères)
- Coûts API pour OpenAI DALL-E (~$0.04 par image)
- FFmpeg doit être installé sur le système

## 🔐 Sécurité

- Ne jamais commiter le fichier `.env`
- Garder les clés API privées
- Limiter l'accès au serveur en production
- Ajouter une authentification si déployé publiquement

## 📦 Dépendances principales

- **express**: Serveur web
- **snoowrap**: Client Reddit API
- **openai**: Génération d'images DALL-E
- **node-gtts**: Text-to-speech Google
- **fluent-ffmpeg**: Montage vidéo
- **canvas**: Génération d'images placeholder

## 🚀 Améliorations futures

- [ ] File d'attente pour gérer plusieurs requêtes
- [ ] Cache des histoires et vidéos
- [ ] Choix de la voix et de la langue
- [ ] Sous-titres automatiques
- [ ] Partage sur réseaux sociaux
- [ ] Sélection manuelle d'histoires
- [ ] Thèmes visuels personnalisables
- [ ] Support de plusieurs subreddits

## 📄 Licence

MIT License - Libre d'utilisation et de modification

## 👨‍💻 Auteur

Créé pour générer automatiquement des vidéos d'histoires d'horreur captivantes.

## 🙏 Crédits

- Histoires: r/scarystories sur Reddit
- Voix IA: Google TTS / ElevenLabs
- Images IA: OpenAI DALL-E 3
- Montage: FFmpeg

---

**⚠️ Avertissement:** Ce projet génère du contenu d'horreur. Le contenu est récupéré automatiquement et peut contenir des thèmes perturbants.
