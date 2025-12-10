import { Router } from 'express';
import { listArticles, getArticle, createArticle } from '../services/articleService.js';
import { testOpenRouterConnection } from '../services/aiClient.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const articles = await listArticles();
    res.json(articles);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ error: 'Failed to fetch articles', details: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const article = await getArticle(req.params.id);
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (err) {
    console.error('Error fetching article:', err);
    res.status(500).json({ error: 'Failed to fetch article', details: err.message });
  }
});

router.post('/generate', async (req, res) => {
  const topic = req.body?.topic || 'B2B SaaS and open-source Web3 infrastructure';
  try {
    const article = await createArticle(topic);
    res.status(201).json(article);
  } catch (err) {
    console.error('Error generating article:', err);
    res.status(500).json({ error: 'Failed to generate article', details: err.message });
  }
});

router.get('/diagnostics/ai', async (_req, res) => {
  try {
    const diagnostics = await testOpenRouterConnection();
    res.json(diagnostics);
  } catch (err) {
    console.error('Error running AI diagnostics:', err);
    res.status(500).json({ error: 'Failed to run diagnostics', details: err.message });
  }
});

export default router;


