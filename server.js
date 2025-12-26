const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/videos', express.static('videos'));

// Routes
const storyRoutes = require('./routes/storyRoutes');
app.use('/api', storyRoutes);

// Page principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎬 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📺 Interface disponible à http://localhost:${PORT}`);
});
