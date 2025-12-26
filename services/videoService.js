const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class VideoService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'videos');
    this.ensureDir();
  }

  async ensureDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      // Dossier existe déjà
    }
  }

  // Créer une vidéo à partir d'images et d'audio
  async createVideo(imagePaths, audioPath, videoId) {
    await this.ensureDir();
    const outputPath = path.join(this.outputDir, `${videoId}.mp4`);

    // Durée par image (en secondes)
    const secondsPerImage = 5;

    return new Promise((resolve, reject) => {
      try {
        // Créer une commande ffmpeg
        let command = ffmpeg();

        // Ajouter chaque image avec sa durée
        imagePaths.forEach((imagePath) => {
          command = command
            .input(imagePath)
            .inputOptions([`-t ${secondsPerImage}`]);
        });

        // Ajouter l'audio
        command = command.input(audioPath);

        // Options de sortie
        command
          .complexFilter([
            // Concaténer toutes les images
            imagePaths.map((_, i) => `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`).join(';'),
            imagePaths.map((_, i) => `[v${i}]`).join('') + `concat=n=${imagePaths.length}:v=1:a=0[outv]`
          ])
          .outputOptions([
            '-map', '[outv]',
            '-map', `${imagePaths.length}:a`,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-shortest'
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log('🎬 Commande FFmpeg:', commandLine);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`⏳ Progression: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('✅ Vidéo créée avec succès:', outputPath);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('❌ Erreur FFmpeg:', err.message);
            reject(err);
          })
          .run();

      } catch (error) {
        reject(error);
      }
    });
  }

  // Version simplifiée avec diaporama d'images
  async createSimpleVideo(imagePaths, audioPath, videoId) {
    await this.ensureDir();
    const outputPath = path.join(this.outputDir, `${videoId}.mp4`);
    
    // Créer un fichier de liste d'images
    const listPath = path.join(this.outputDir, `${videoId}_list.txt`);
    const listContent = imagePaths
      .map(p => `file '${p.replace(/\\/g, '/')}'\nduration 5`)
      .join('\n') + `\nfile '${imagePaths[imagePaths.length - 1].replace(/\\/g, '/')}'`;
    
    await fs.writeFile(listPath, listContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .input(audioPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-shortest'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('🎬 Création vidéo:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ Progression: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', async () => {
          // Nettoyer le fichier temporaire
          try {
            await fs.unlink(listPath);
          } catch (e) {
            // Ignorer les erreurs de nettoyage
          }
          console.log('✅ Vidéo créée:', outputPath);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Erreur création vidéo:', err.message);
          reject(err);
        })
        .run();
    });
  }

  // Méthode principale avec fallback
  async createVideoWithFallback(imagePaths, audioPath, videoId) {
    try {
      return await this.createSimpleVideo(imagePaths, audioPath, videoId);
    } catch (error) {
      console.error('Erreur création vidéo:', error.message);
      throw error;
    }
  }
}

module.exports = new VideoService();
module.exports.createVideo = async function(imagePaths, audioPath, videoId) {
  const service = new VideoService();
  return service.createSimpleVideo(imagePaths, audioPath, videoId);
};
