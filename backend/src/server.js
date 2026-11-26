const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment configuration (only effective locally)
const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env') });

// Initialize database connection & schema
require('./config/database');

const healthRoutes = require('./routes/healthRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// API Routes (mounted with and without /api prefix for Vercel rewrite compatibility)
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

app.use('/api/transactions', transactionRoutes);
app.use('/transactions', transactionRoutes);

app.use('/api/budgets', budgetRoutes);
app.use('/budgets', budgetRoutes);

// Base API route check
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Expense Tracker API is live' });
});

// JSON 404 handler for unknown /api endpoints
app.use('/api', notFoundHandler);

// Resolve frontend directory containing index.html and /src
const searchDirs = [
  path.resolve(__dirname, '../..'),
  path.resolve(__dirname, '../../..'),
  path.resolve(__dirname, '../../public'),
  path.resolve(process.cwd()),
  path.resolve(process.cwd(), 'public'),
];

function findAsset(subpath) {
  for (const base of searchDirs) {
    const candidate = path.join(base, subpath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Explicit route for CSS to guarantee proper MIME type
app.get('/src/styles.css', (req, res) => {
  const filePath = findAsset('src/styles.css');
  if (filePath) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    return res.sendFile(filePath);
  }
  res.status(404).type('text/plain').send('styles.css not found');
});

// Explicit route for app.js to guarantee proper MIME type
app.get('/src/app.js', (req, res) => {
  const filePath = findAsset('src/app.js');
  if (filePath) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    return res.sendFile(filePath);
  }
  res.status(404).type('text/plain').send('app.js not found');
});

// Serve static assets from all potential frontend locations
for (const dir of searchDirs) {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
  }
}

// Serve index.html on root GET /
app.get('/', (req, res) => {
  const indexPath = findAsset('index.html');
  if (indexPath) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(indexPath);
  }
  res.status(404).send('index.html not found');
});

// Fallback to index.html ONLY for extensionless routes (SPA routing)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    const indexPath = findAsset('index.html');
    if (indexPath) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Central error-handling middleware
app.use(errorHandler);

// Start server when executed directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Expense Tracker server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
