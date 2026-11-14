const db = require('../config/database');

// Helper to validate YYYY-MM-DD format and valid calendar date
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return (
    dateObj.getFullYear() === y &&
    dateObj.getMonth() === m - 1 &&
    dateObj.getDate() === d
  );
}

// Helper to validate and normalize transaction payload
function validateTransactionPayload(body) {
  const { title, description, amount, category, type, date } = body;

  const resolvedTitle = (title && typeof title === 'string' ? title.trim() : '') ||
    (description && typeof description === 'string' ? description.trim() : '');

  if (!resolvedTitle) {
    return { error: 'Transaction title or description is required.' };
  }

  const numAmount = Number(amount);
  if (typeof amount === 'undefined' || amount === null || !Number.isFinite(numAmount) || numAmount <= 0) {
    return { error: 'Amount must be a number greater than 0.' };
  }

  if (!type || (type !== 'income' && type !== 'expense')) {
    return { error: 'Type must be either "income" or "expense".' };
  }

  if (!category || typeof category !== 'string' || !category.trim()) {
    return { error: 'Category is required.' };
  }

  if (!date || !isValidDate(date)) {
    return { error: 'Date must be a valid date in YYYY-MM-DD format.' };
  }

  return {
    value: {
      title: resolvedTitle,
      description: (description && typeof description === 'string' ? description.trim() : resolvedTitle),
      amount: Math.round(numAmount * 100) / 100,
      category: category.trim(),
      type,
      date,
    },
  };
}

// GET /api/transactions
function getAllTransactions(req, res, next) {
  try {
    const stmt = db.prepare('SELECT id, title, amount, category, type, date, description, created_at FROM transactions ORDER BY date DESC, id DESC');
    const transactions = stmt.all();
    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/transactions/:id
function getTransactionById(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID. Must be a positive integer.',
      });
    }

    const stmt = db.prepare('SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?');
    const transaction = stmt.get(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`,
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/transactions
function createTransaction(req, res, next) {
  try {
    const validation = validateTransactionPayload(req.body);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const { title, description, amount, category, type, date } = validation.value;
    const stmt = db.prepare(
      'INSERT INTO transactions (title, description, amount, category, type, date) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const info = stmt.run(title, description, amount, category, type, date);

    const getStmt = db.prepare('SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?');
    const newTransaction = getStmt.get(info.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newTransaction,
      message: 'Transaction created successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/transactions/:id
function updateTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID. Must be a positive integer.',
      });
    }

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`,
      });
    }

    const validation = validateTransactionPayload(req.body);
    if (validation.error) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const { title, description, amount, category, type, date } = validation.value;
    const stmt = db.prepare(
      'UPDATE transactions SET title = ?, description = ?, amount = ?, category = ?, type = ?, date = ? WHERE id = ?'
    );
    stmt.run(title, description, amount, category, type, date, id);

    const getStmt = db.prepare('SELECT id, title, amount, category, type, date, description, created_at FROM transactions WHERE id = ?');
    const updatedTransaction = getStmt.get(id);

    res.status(200).json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/transactions/:id
function deleteTransaction(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID. Must be a positive integer.',
      });
    }

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
    const existing = checkStmt.get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: `Transaction with ID ${id} not found.`,
      });
    }

    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    stmt.run(id);

    res.status(200).json({
      success: true,
      message: `Transaction with ID ${id} deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
