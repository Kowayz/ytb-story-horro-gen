const express = require('express');
const router = express.Router();
const redditService = require('../services/redditService');
const ttsService = require('../services/ttsService');
const imageService = require('../services/imageService');
const videoService = require('../services/videoService');
const fs = require('fs').promises;
const path = require('path');

// Récupérer une histoire aléatoire
router.get('/story/random', async (req, res) => {
  try {
    const story = await redditService.getRandomHorrorStory();
    res.json(story);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Générer une vidéo complète
router.post('/generate-video', async (req, res) => {
  try {
    const { storyId } = req.body;
    
    // 1. Récupérer l'histoire
    console.log('📖 Récupération de l\'histoire...');
    const story = await redditService.getRandomHorrorStory();
    
    // 2. Découper en scènes
    console.log('🎬 Découpage en scènes...');
    const scenes = redditService.splitIntoScenes(story.text);
    
    // 3. Générer l'audio (narration complète)
    console.log('🎙️ Génération de la narration...');
    const audioPath = await ttsService.generateAudio(
      `${story.title}. ${story.text}`,
      story.id
    );
    
    // 4. Générer les images pour chaque scène
    console.log('🎨 Génération des images...');
    const imagePromises = scenes.map((scene, index) => 
      imageService.generateImage(scene, `${story.id}_scene_${index}`)
    );
    const imagePaths = await Promise.all(imagePromises);
    
    // 5. Créer la vidéo
    console.log('🎥 Assemblage de la vidéo...');
    const videoPath = await videoService.createVideo(
      imagePaths,
      audioPath,
      story.id
    );
    
    // 6. Retourner l'URL de la vidéo
    const videoUrl = `/videos/${path.basename(videoPath)}`;
    
    res.json({
      success: true,
      story: {
        id: story.id,
        title: story.title,
        author: story.author,
        url: story.url
      },
      videoUrl: videoUrl,
      duration: scenes.length * 5 // Estimation
    });
    
  } catch (error) {
    console.error('Erreur génération vidéo:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Obtenir le statut d'une vidéo
router.get('/video/:videoId', async (req, res) => {
  try {
    const videoPath = path.join(__dirname, '..', 'videos', `${req.params.videoId}.mp4`);
    
    try {
      await fs.access(videoPath);
      res.json({ 
        exists: true, 
        url: `/videos/${req.params.videoId}.mp4` 
      });
    } catch {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
