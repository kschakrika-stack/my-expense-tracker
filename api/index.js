import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const app = require('../backend/src/server');

export default app;
