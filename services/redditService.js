const axios = require('axios');
const snoowrap = require('snoowrap');

class RedditService {
  constructor() {
    this.reddit = null;
    // Initialiser snoowrap seulement si les identifiants sont présents
    if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET && process.env.REDDIT_USER_AGENT && process.env.REDDIT_REFRESH_TOKEN) {
      this.reddit = new snoowrap({
        userAgent: process.env.REDDIT_USER_AGENT,
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        refreshToken: process.env.REDDIT_REFRESH_TOKEN
      });
    }
  }

  async getRandomHorrorStory() {
    try {
      let posts = [];

      if (this.reddit) {
        // Utiliser snoowrap si configuré
        posts = await this.reddit.getSubreddit('scarystories').getHot({ limit: 100 });
        posts = posts.map(p => ({
          id: p.id,
          title: p.title,
          selftext: p.selftext,
          author: p.author?.name || 'unknown',
          permalink: p.permalink,
          score: p.score,
          created_utc: p.created_utc,
          over_18: p.over_18
        }));
      } else {
        // Fallback: API publique Reddit sans authentification
        const resp = await axios.get('https://www.reddit.com/r/scarystories/hot.json?limit=100', {
          headers: { 'User-Agent': process.env.REDDIT_USER_AGENT || 'horror-story-bot/1.0' }
        });
        posts = (resp.data.data.children || []).map(c => ({
          id: c.data.id,
          title: c.data.title,
          selftext: c.data.selftext,
          author: c.data.author,
          permalink: c.data.permalink,
          score: c.data.score,
          created_utc: c.data.created_utc,
          over_18: c.data.over_18
        }));
      }

      const validPosts = posts.filter(post =>
        post.selftext &&
        post.selftext.length > 500 &&
        post.selftext.length < 5000 &&
        !post.over_18
      );

      if (validPosts.length === 0) {
        throw new Error('Aucune histoire valide trouvée');
      }

      const randomPost = validPosts[Math.floor(Math.random() * validPosts.length)];

      return {
        id: randomPost.id,
        title: randomPost.title,
        text: randomPost.selftext,
        author: randomPost.author,
        url: `https://reddit.com${randomPost.permalink}`,
        score: randomPost.score,
        created: new Date(randomPost.created_utc * 1000)
      };
    } catch (error) {
      console.error('Erreur récupération Reddit:', error.message);

      // Retourner une histoire d'exemple en cas d'erreur
      return {
        id: 'demo',
        title: 'The Midnight Visitor',
        text: `I always thought the scratching sounds in my walls were just mice. I set traps, called an exterminator, even tried to seal up any holes I could find. But the scratching continued, night after night, always at exactly 3:13 AM.

Last night, I decided to stay awake and investigate. Armed with a flashlight and a baseball bat, I waited in the darkness of my bedroom. At 3:13 AM, the scratching began. But this time, it wasn't coming from the walls.

It was coming from under my bed.

I slowly leaned over the edge, shining my flashlight into the darkness below. Two pale hands reached out and grabbed my wrist. The grip was ice cold. A raspy voice whispered: "Finally... you're awake."

I never sleep in that room anymore.`,
        author: 'DemoAuthor',
        url: 'https://reddit.com/r/scarystories',
        score: 0,
        created: new Date()
      };
    }
  }

  // Diviser le texte en segments pour la génération d'images
  splitIntoScenes(text, maxScenes = 5) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const scenesPerSegment = Math.ceil(sentences.length / maxScenes);
    const scenes = [];

    for (let i = 0; i < sentences.length; i += scenesPerSegment) {
      const sceneText = sentences.slice(i, i + scenesPerSegment).join(' ').trim();
      if (sceneText) {
        scenes.push(sceneText);
      }
    }

    return scenes.slice(0, maxScenes);
  }
}

module.exports = new RedditService();
