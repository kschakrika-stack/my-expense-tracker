const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');

// GET /api/budgets/:year/:month
router.get('/:year/:month', budgetController.getBudgetByMonth);

// POST /api/budgets
router.post('/', budgetController.createBudget);

// PUT /api/budgets/:id
router.put('/:id', budgetController.updateBudget);

module.exports = router;
