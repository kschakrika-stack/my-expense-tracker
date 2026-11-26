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

// API Routes
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

// Statically traceable asset paths (analyzed by Vercel NFT bundler at build time)
const INDEX_HTML_PATH = path.join(__dirname, '../../index.html');
const STYLES_CSS_PATH = path.join(__dirname, '../../src/styles.css');
const APP_JS_PATH = path.join(__dirname, '../../src/app.js');

// Pre-read frontend assets into memory
let indexHtmlContent = '';
let stylesCssContent = '';
let appJsContent = '';

try {
  indexHtmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
} catch (e) {
  console.warn('[Server] Notice: could not read index.html:', e.message);
}

try {
  stylesCssContent = fs.readFileSync(STYLES_CSS_PATH, 'utf8');
} catch (e) {
  console.warn('[Server] Notice: could not read styles.css:', e.message);
}

try {
  appJsContent = fs.readFileSync(APP_JS_PATH, 'utf8');
} catch (e) {
  console.warn('[Server] Notice: could not read app.js:', e.message);
}

// Explicit routes for frontend assets to guarantee correct Content-Type headers
app.get('/', (req, res) => {
  if (indexHtmlContent) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(indexHtmlContent);
  }
  if (fs.existsSync(INDEX_HTML_PATH)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(INDEX_HTML_PATH);
  }
  res.status(404).type('text/html').send('<!doctype html><h1>ClearLedger</h1><p>index.html not found</p>');
});

app.get('/src/styles.css', (req, res) => {
  if (stylesCssContent) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    return res.send(stylesCssContent);
  }
  if (fs.existsSync(STYLES_CSS_PATH)) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    return res.sendFile(STYLES_CSS_PATH);
  }
  res.status(404).type('text/plain').send('/* styles.css not found */');
});

app.get('/src/app.js', (req, res) => {
  if (appJsContent) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    return res.send(appJsContent);
  }
  if (fs.existsSync(APP_JS_PATH)) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    return res.sendFile(APP_JS_PATH);
  }
  res.status(404).type('text/plain').send('// app.js not found');
});

// JSON 404 handler for unknown /api endpoints
app.use('/api', notFoundHandler);

// Fallback to index.html for client-side SPA routing (only extensionless paths)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    if (indexHtmlContent) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(indexHtmlContent);
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
