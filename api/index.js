// Vercel Serverless Function entry point
// All requests are routed here by vercel.json and forwarded to the Express app.
const app = require('../backend/src/server');

module.exports = app;
