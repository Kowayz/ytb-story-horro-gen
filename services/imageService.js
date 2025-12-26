const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class ImageService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'images');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.ensureDir();
  }

  async ensureDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Dossier existe déjà
    }
  }

  // Créer un prompt optimisé pour les images d'horreur
  createHorrorPrompt(sceneText) {
    // Extraire les éléments clés de la scène
    const prompt = `Dark horror scene: ${sceneText.substring(0, 200)}. 
    Cinematic lighting, atmospheric, eerie, mysterious, dark shadows, 
    horror movie style, high quality, dramatic composition`;
    
    return prompt;
  }

  // Générer une image avec DALL-E 3
  async generateImageWithDallE(sceneText, filename) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key non configurée');
    }

    await this.ensureDir();
    const outputPath = path.join(this.outputDir, `${filename}.png`);

    try {
      const prompt = this.createHorrorPrompt(sceneText);
      
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      });

      const imageUrl = response.data[0].url;
      
      // Télécharger l'image
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      });
      
      await fs.writeFile(outputPath, imageResponse.data);
      console.log(`✅ Image générée: ${filename}`);
      
      return outputPath;
    } catch (error) {
      console.error('Erreur génération image DALL-E:', error.message);
      throw error;
    }
  }

  // Créer une image placeholder en cas d'erreur
  async createPlaceholderImage(filename) {
    await this.ensureDir();
    const outputPath = path.join(this.outputDir, `${filename}.png`);

    // Générer une image noire 1024x1024 via FFmpeg (aucune dépendance native)
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input('color=c=black:s=1024x1024:d=1')
        .inputOptions(['-f', 'lavfi'])
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', err => reject(err))
        .run();
    });
  }

  // Méthode principale avec fallback
  async generateImage(sceneText, filename) {
    try {
      // Essayer DALL-E si la clé est configurée
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        console.log('Génération image DALL-E pour:', filename);
        return await this.generateImageWithDallE(sceneText, filename);
      } else {
        console.log('OpenAI non configuré, utilisation d\'images placeholder');
        return await this.createPlaceholderImage(filename);
      }
    } catch (error) {
      console.error(`Erreur génération ${filename}, création placeholder:`, error.message);
      return await this.createPlaceholderImage(filename);
    }
  }
}

module.exports = new ImageService();
