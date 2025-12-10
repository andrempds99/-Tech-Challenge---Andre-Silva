import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import articlesRouter from './routes/articles.js';
import { startArticleJob } from './services/articleJob.js';
import db from './db.js';
import './services/articleService.js'; // ensures seeding

dotenv.config();

// Validate environment variables
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️  OPENROUTER_API_KEY not set. AI generation will use fallback templates.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN?.split(',') || '*'
  })
);

app.use('/api/articles', articlesRouter);

app.get('/health', async (_req, res) => {
  try {
    // Check database connectivity
    await new Promise((resolve, reject) => {
      db.get('SELECT 1', (err) => err ? reject(err) : resolve());
    });
    res.json({ ok: true, db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected', error: err.message });
  }
});

// serve static files if mounted with build (optional)
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
  startArticleJob();
});


