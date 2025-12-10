import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
});

function ArticleList({ articles, onSelect, selectedId }) {
  return (
    <aside className="article-list">
      <div className="list-header">
        <h2>Articles</h2>
        <span className="count">{articles.length}</span>
      </div>
      <div className="list">
        {articles.length === 0 ? (
          <div className="empty-state">No articles yet</div>
        ) : (
          articles.map(article => (
            <button
              key={article.id}
              className={selectedId === article.id ? 'card active' : 'card'}
              onClick={() => onSelect(article.id)}
            >
              <div className="card-content">
                <h3>{article.title}</h3>
                <time className="card-date">{new Date(article.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}</time>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function ArticleView({ article }) {
  if (!article) {
    return (
      <div className="article-view empty-view">
        <div className="empty-content">
          <p>Select an article to read</p>
        </div>
      </div>
    );
  }
  
  const date = new Date(article.created_at);
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
  
  return (
    <article className="article-view">
      <header className="article-header">
        <h1 className="article-title">{article.title}</h1>
        <time className="article-date">{formattedDate}</time>
      </header>
      <div className="article-content">
        <div className="content-text">{article.content}</div>
      </div>
    </article>
  );
}

export default function App() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/articles');
      setArticles(data);
      if (data.length && !selected) setSelected(data[0].id);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
      alert('Failed to load articles. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOne = async id => {
    try {
      const { data } = await api.get(`/articles/${id}`);
      setSelected(data.id);
      setArticles(prev => prev.map(a => (a.id === id ? data : a)));
    } catch (err) {
      console.error('Failed to fetch article:', err);
    }
  };

  const generateArticle = async () => {
    setCreating(true);
    try {
      await api.post('/articles/generate', { topic: 'engineering productivity' });
      await fetchArticles();
    } catch (err) {
      console.error('Failed to generate article:', err);
      alert('Failed to generate article. Check console for details.');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchArticles().catch(console.error);
  }, []);

  const activeArticle = articles.find(a => a.id === selected);

  return (
    <div className="app">
      <header className="main-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="logo">Assimetria</h1>
            <p className="tagline">Engineering Insights</p>
          </div>
          <nav className="header-actions">
            <button 
              className="btn btn-secondary" 
              onClick={fetchArticles} 
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={generateArticle} 
              disabled={creating}
            >
              {creating ? 'Generating...' : 'Generate New'}
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">
        <ArticleList
          articles={articles}
          onSelect={id => fetchOne(id).catch(console.error)}
          selectedId={selected}
        />
        <ArticleView article={activeArticle} />
      </main>
    </div>
  );
}


