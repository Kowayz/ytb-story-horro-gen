const gtts = require('node-gtts')('fr');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class TTSService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'audio');
    this.ensureDir();
  }

  async ensureDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Dossier existe déjà
    }
  }

  // Utiliser Google TTS (gratuit)
  async generateAudioWithGoogle(text, filename) {
    const outputPath = path.join(this.outputDir, `${filename}.mp3`);
    
    return new Promise((resolve, reject) => {
      gtts.save(outputPath, text, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(outputPath);
        }
      });
    });
  }

  // Utiliser ElevenLabs (premium, meilleure qualité)
  async generateAudioWithElevenLabs(text, filename) {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key non configurée');
    }

    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam (voix masculine)
    const outputPath = path.join(this.outputDir, `${filename}.mp3`);

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      await fs.writeFile(outputPath, response.data);
      return outputPath;
    } catch (error) {
      console.error('Erreur ElevenLabs:', error.message);
      throw error;
    }
  }

  // Méthode principale avec fallback
  async generateAudio(text, filename) {
    await this.ensureDir();

    // Limiter la longueur du texte si nécessaire
    const maxLength = 5000;
    let processedText = text;
    
    if (text.length > maxLength) {
      processedText = text.substring(0, maxLength) + '...';
    }

    try {
      // Essayer ElevenLabs d'abord si la clé est configurée
      if (process.env.ELEVENLABS_API_KEY) {
        console.log('Utilisation de ElevenLabs pour TTS...');
        return await this.generateAudioWithElevenLabs(processedText, filename);
      }
    } catch (error) {
      console.log('ElevenLabs échoué, utilisation de Google TTS...');
    }

    // Fallback sur Google TTS
    console.log('Utilisation de Google TTS...');
    return await this.generateAudioWithGoogle(processedText, filename);
  }

  // Obtenir la durée de l'audio (approximative)
  estimateAudioDuration(text, wordsPerMinute = 150) {
    const words = text.split(/\s+/).length;
    const minutes = words / wordsPerMinute;
    return Math.ceil(minutes * 60); // Retourner en secondes
  }
}

module.exports = new TTSService();
