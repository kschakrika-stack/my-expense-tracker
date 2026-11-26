const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment configuration
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
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);

// JSON 404 handler for unknown /api endpoints
app.use('/api', notFoundHandler);

// Serve frontend static files from the project folder without moving them
const frontendDir = path.resolve(__dirname, '../..');
app.use(express.static(frontendDir));

// Fallback to index.html for non-API GET requests (SPA support in Express 5)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(frontendDir, 'index.html'));
  }
  next();
});

// Central error-handling middleware
app.use(errorHandler);

// Start server when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Expense Tracker server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
