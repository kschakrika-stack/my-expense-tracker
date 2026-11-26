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
const possibleDirs = [
  path.resolve(__dirname, '../..'),
  path.resolve(__dirname, '../../..'),
  process.cwd(),
];

let frontendDir = possibleDirs[0];
for (const dir of possibleDirs) {
  if (fs.existsSync(path.join(dir, 'index.html'))) {
    frontendDir = dir;
    break;
  }
}

// Serve frontend static assets (styles.css, app.js, images, icons)
app.use(express.static(frontendDir));

// Serve index.html on root GET / (works on local server and Vercel)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Fallback to index.html ONLY for extensionless routes (SPA routing)
// Files with extensions (.css, .js, .png) will NOT return index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
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
