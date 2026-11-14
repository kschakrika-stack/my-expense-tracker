const db = require('../config/database');

// GET /api/budgets/:year/:month
function getBudgetByMonth(req, res, next) {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year. Must be a valid 4-digit year.',
      });
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month. Must be an integer between 1 and 12.',
      });
    }

    const stmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE year = ? AND month = ?');
    const budget = stmt.get(year, month);

    if (!budget) {
      return res.status(404).json({
        success: false,
        error: `Budget for ${year}-${String(month).padStart(2, '0')} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/budgets
function createBudget(req, res, next) {
  try {
    const { year, month, amount } = req.body;

    const numYear = Number(year);
    const numMonth = Number(month);
    const numAmount = Number(amount);

    if (!Number.isInteger(numYear) || numYear < 1900 || numYear > 2200) {
      return res.status(400).json({
        success: false,
        error: 'Year is required and must be a valid 4-digit integer.',
      });
    }

    if (!Number.isInteger(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({
        success: false,
        error: 'Month is required and must be an integer between 1 and 12.',
      });
    }

    if (typeof amount === 'undefined' || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a number greater than 0.',
      });
    }

    // Check if budget for this year and month already exists (UNIQUE constraint)
    const checkStmt = db.prepare('SELECT id FROM monthly_budgets WHERE year = ? AND month = ?');
    const existing = checkStmt.get(numYear, numMonth);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A budget for ${numYear}-${String(numMonth).padStart(2, '0')} already exists. Use PUT /api/budgets/${existing.id} to update it.`,
      });
    }

    const roundedAmount = Math.round(numAmount * 100) / 100;
    const insertStmt = db.prepare('INSERT INTO monthly_budgets (month, year, amount) VALUES (?, ?, ?)');
    const info = insertStmt.run(numMonth, numYear, roundedAmount);

    const getStmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?');
    const newBudget = getStmt.get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newBudget,
      message: 'Budget created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/budgets/:id
function updateBudget(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid budget ID. Must be a positive integer.',
      });
    }

    const checkStmt = db.prepare('SELECT id, month, year, amount FROM monthly_budgets WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Budget with ID ${id} not found.`,
      });
    }

    const { amount } = req.body;
    const numAmount = Number(amount);
    if (typeof amount === 'undefined' || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be a number greater than 0.',
      });
    }

    const roundedAmount = Math.round(numAmount * 100) / 100;
    const updateStmt = db.prepare('UPDATE monthly_budgets SET amount = ? WHERE id = ?');
    updateStmt.run(roundedAmount, id);

    const getStmt = db.prepare('SELECT id, month, year, amount, created_at FROM monthly_budgets WHERE id = ?');
    const updatedBudget = getStmt.get(id);

    res.status(200).json({
      success: true,
      data: updatedBudget,
      message: 'Budget updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBudgetByMonth,
  createBudget,
  updateBudget,
};
