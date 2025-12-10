import db from '../db.js';
import { generateArticle } from './aiClient.js';

function seedIfEmpty() {
  db.get('SELECT COUNT(*) AS count FROM articles', (err, row) => {
    if (err) {
      console.error('Seed check failed', err);
      return;
    }
    if (row.count === 0) {
      const samples = [
        { 
          title: 'Building Product-Led Growth in B2B SaaS', 
          content: 'Product-Led Growth (PLG) has become the dominant go-to-market strategy for modern B2B SaaS companies. Unlike traditional sales-led approaches, PLG focuses on delivering immediate value through the product itself, allowing users to experience core functionality before committing to a purchase. Successful PLG implementations require seamless onboarding flows, in-app guidance, and freemium models that showcase your product\'s unique value proposition. Key metrics to track include time-to-value, feature adoption rates, and conversion from free to paid tiers. Companies like Slack, Notion, and Figma have demonstrated that when done right, PLG can dramatically reduce customer acquisition costs while increasing organic growth through viral loops and word-of-mouth referrals.' 
        },
        { 
          title: 'Decentralized Storage Networks: The Foundation of Web3 Infrastructure', 
          content: 'Decentralized storage networks like IPFS, Arweave, and Filecoin are revolutionizing how data is stored and accessed on the internet. Unlike traditional cloud storage, these networks distribute data across thousands of nodes, eliminating single points of failure and reducing censorship risks. IPFS (InterPlanetary File System) uses content-addressing to create a distributed web where files are identified by their cryptographic hash rather than location. Arweave offers permanent storage through a novel consensus mechanism called Proof of Access, while Filecoin creates a marketplace for storage providers. These technologies are critical infrastructure for Web3 applications, enabling decentralized social networks, NFT marketplaces, and blockchain-based applications that require reliable, censorship-resistant data storage.' 
        },
        { 
          title: 'Customer Success Metrics That Drive B2B SaaS Retention', 
          content: 'In B2B SaaS, customer retention is the lifeblood of sustainable growth. While acquisition metrics get attention, retention metrics directly impact revenue and profitability. Key indicators include Net Revenue Retention (NRR), which measures expansion revenue from existing customers, and Customer Lifetime Value (LTV) to Customer Acquisition Cost (CAC) ratios. Product engagement scores, feature adoption rates, and time-to-first-value are leading indicators of churn risk. Successful SaaS companies implement health scoring systems that combine product usage, support ticket volume, and payment behavior to identify at-risk accounts early. Proactive outreach, personalized onboarding, and strategic account management can turn potential churn into expansion opportunities, transforming satisfied customers into advocates who drive referrals and case studies.' 
        }
      ];
      const stmt = db.prepare('INSERT INTO articles (title, content) VALUES (?, ?)');
      samples.forEach(a => stmt.run(a.title, a.content));
      stmt.finalize();
      console.log('Seeded initial articles');
    }
  });
}

seedIfEmpty();

export function listArticles() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, title, content, created_at FROM articles ORDER BY created_at DESC', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getArticle(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, title, content, created_at FROM articles WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export async function createArticle(topic = 'B2B SaaS and open-source Web3 infrastructure') {
  const { title, content } = await generateArticle(topic);

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO articles (title, content) VALUES (?, ?)',
      [title, content],
      function insertCallback(err) {
        if (err) return reject(err);
        // Fetch the complete article with created_at
        db.get(
          'SELECT id, title, content, created_at FROM articles WHERE id = ?',
          [this.lastID],
          (fetchErr, row) => {
            if (fetchErr) return reject(fetchErr);
            resolve(row);
          }
        );
      }
    );
  });
}


