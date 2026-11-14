/**
 * ClearLedger — Personal Expense Tracker
 * Pure Vanilla JavaScript (ES6+) with LocalStorage persistence, Chart.js & Lucide Icons.
 */

(function () {
  'use strict';

  const API_BASE =
    typeof window !== 'undefined' && window.location.protocol === 'file:'
      ? 'http://localhost:3000/api'
      : '/api';

  const STORAGE_KEYS = {
    TRANSACTIONS: 'clearledger_transactions_v1',
    BUDGET: 'clearledger_monthly_budget_v1',
    INITIALIZED: 'clearledger_initialized_v1',
    MIGRATED: 'clearledger_backend_migrated_v1',
  };

  const CATEGORIES = {
    expense: [
      'Housing & Rent',
      'Food & Dining',
      'Transportation',
      'Utilities & Bills',
      'Healthcare',
      'Shopping',
      'Entertainment',
      'Subscriptions',
      'Travel',
      'Other Expense',
    ],
    income: [
      'Salary',
      'Freelance',
      'Investments',
      'Rental Income',
      'Refunds',
      'Other Income',
    ],
  };

  const CATEGORY_COLORS = [
    '#0f172a',
    '#2563eb',
    '#0d9488',
    '#d97706',
    '#dc2626',
    '#7c3aed',
    '#059669',
    '#db2777',
    '#4f46e5',
    '#64748b',
  ];

  const VIEW_META = {
    dashboard: { breadcrumb: 'Overview', title: 'Dashboard' },
    manage: { breadcrumb: 'Entries', title: 'Income & Expense' },
    history: { breadcrumb: 'Ledger', title: 'Transaction History' },
    analytics: { breadcrumb: 'Insights', title: 'Expense Analytics' },
    budget: { breadcrumb: 'Planning', title: 'Budget Management' },
  };

  const state = {
    transactions: [],
    monthlyBudget: 3200,
    currentBudgetId: null,
    isLoading: false,
    backendError: null,
    activeView: 'dashboard',
    activeMonth: getTodayMonthKey(),
    filters: {
      search: '',
      type: 'all',
      category: 'all',
      sort: 'date-desc',
    },
    charts: {
      monthlyOverview: null,
      dashCategories: null,
      incomeVsExpense: null,
      categoryBars: null,
      spendingDistribution: null,
    },
    pendingConfirmCallback: null,
  };

  /* -------------------------------------------------------------------------- */
  /* Utility Helpers                                                            */
  /* -------------------------------------------------------------------------- */

  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTodayMonthKey() {
    return getTodayDateString().slice(0, 7);
  }

  function shiftMonthKey(monthKey, deltaMonths) {
    const [yearStr, monthStr] = monthKey.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1 + deltaMonths, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function formatMonthLabel(monthKey) {
    const [yearStr, monthStr] = monthKey.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatShortMonthLabel(monthKey) {
    const [yearStr, monthStr] = monthKey.split('-');
    const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  function formatDateDisplay(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatCurrency(amount) {
    const num = Number(amount) || 0;
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return num < 0 ? `-₹${formatted}` : `₹${formatted}`;
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /* -------------------------------------------------------------------------- */
  /* LocalStorage & Seed Data                                                   */
  /* -------------------------------------------------------------------------- */

  function buildSeedTransactions() {
    const m0 = getTodayMonthKey();
    const m1 = shiftMonthKey(m0, -1);
    const m2 = shiftMonthKey(m0, -2);
    const m3 = shiftMonthKey(m0, -3);
    const m4 = shiftMonthKey(m0, -4);
    const m5 = shiftMonthKey(m0, -5);

    const todayDay = Math.min(Number(getTodayDateString().slice(8, 10)), 28);
    const padDay = (n) => String(Math.max(1, Math.min(n, 28))).padStart(2, '0');

    return [
      // Current Month
      { id: generateId(), type: 'income', amount: 5200.00, category: 'Salary', description: 'Monthly Software Engineering Payroll', date: `${m0}-01` },
      { id: generateId(), type: 'income', amount: 650.00, category: 'Freelance', description: 'UI Architecture Consultation', date: `${m0}-${padDay(Math.min(todayDay, 8))}` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m0}-02` },
      { id: generateId(), type: 'expense', amount: 312.40, category: 'Food & Dining', description: 'Whole Foods & Weekly Groceries', date: `${m0}-${padDay(Math.min(todayDay, 5))}` },
      { id: generateId(), type: 'expense', amount: 148.90, category: 'Utilities & Bills', description: 'Electric & Fiber Internet', date: `${m0}-${padDay(Math.min(todayDay, 7))}` },
      { id: generateId(), type: 'expense', amount: 94.50, category: 'Transportation', description: 'City Transit Pass & Fuel', date: `${m0}-${padDay(Math.min(todayDay, 10))}` },
      { id: generateId(), type: 'expense', amount: 58.00, category: 'Subscriptions', description: 'Cloud Storage & Productivity Suite', date: `${m0}-${padDay(Math.min(todayDay, 11))}` },
      { id: generateId(), type: 'expense', amount: 126.75, category: 'Food & Dining', description: 'Team Lunch & Coffee Roasters', date: `${m0}-${padDay(todayDay)}` },

      // Month -1
      { id: generateId(), type: 'income', amount: 5200.00, category: 'Salary', description: 'Monthly Payroll Deposit', date: `${m1}-01` },
      { id: generateId(), type: 'income', amount: 240.00, category: 'Investments', description: 'Quarterly Index ETF Dividend', date: `${m1}-15` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m1}-02` },
      { id: generateId(), type: 'expense', amount: 428.10, category: 'Food & Dining', description: 'Groceries & Dining Out', date: `${m1}-09` },
      { id: generateId(), type: 'expense', amount: 215.00, category: 'Healthcare', description: 'Dental Checkup & Pharmacy', date: `${m1}-14` },
      { id: generateId(), type: 'expense', amount: 162.30, category: 'Utilities & Bills', description: 'Water, Electric & Internet', date: `${m1}-18` },
      { id: generateId(), type: 'expense', amount: 189.00, category: 'Shopping', description: 'Running Shoes & Apparel', date: `${m1}-22` },

      // Month -2
      { id: generateId(), type: 'income', amount: 5200.00, category: 'Salary', description: 'Monthly Payroll Deposit', date: `${m2}-01` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m2}-02` },
      { id: generateId(), type: 'expense', amount: 540.00, category: 'Travel', description: 'Regional Rail & Weekend Hotel', date: `${m2}-12` },
      { id: generateId(), type: 'expense', amount: 390.25, category: 'Food & Dining', description: 'Market Groceries & Restaurants', date: `${m2}-19` },
      { id: generateId(), type: 'expense', amount: 112.00, category: 'Transportation', description: 'Transit & Ride Share', date: `${m2}-24` },

      // Month -3
      { id: generateId(), type: 'income', amount: 5200.00, category: 'Salary', description: 'Monthly Payroll Deposit', date: `${m3}-01` },
      { id: generateId(), type: 'income', amount: 900.00, category: 'Freelance', description: 'Design System Audit', date: `${m3}-16` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m3}-02` },
      { id: generateId(), type: 'expense', amount: 365.80, category: 'Food & Dining', description: 'Weekly Groceries', date: `${m3}-10` },
      { id: generateId(), type: 'expense', amount: 155.40, category: 'Utilities & Bills', description: 'Home Utilities & Mobile Plan', date: `${m3}-20` },
      { id: generateId(), type: 'expense', amount: 88.00, category: 'Entertainment', description: 'Concert & Museum Tickets', date: `${m3}-26` },

      // Month -4
      { id: generateId(), type: 'income', amount: 4950.00, category: 'Salary', description: 'Monthly Payroll Deposit', date: `${m4}-01` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m4}-02` },
      { id: generateId(), type: 'expense', amount: 342.00, category: 'Food & Dining', description: 'Groceries & Produce', date: `${m4}-11` },
      { id: generateId(), type: 'expense', amount: 245.50, category: 'Shopping', description: 'Home Office Desk Lamp', date: `${m4}-17` },

      // Month -5
      { id: generateId(), type: 'income', amount: 4950.00, category: 'Salary', description: 'Monthly Payroll Deposit', date: `${m5}-01` },
      { id: generateId(), type: 'expense', amount: 1450.00, category: 'Housing & Rent', description: 'Apartment Monthly Rent', date: `${m5}-02` },
      { id: generateId(), type: 'expense', amount: 318.60, category: 'Food & Dining', description: 'Groceries & Coffee', date: `${m5}-13` },
      { id: generateId(), type: 'expense', amount: 140.00, category: 'Utilities & Bills', description: 'Electric & Internet', date: `${m5}-21` },
    ];
  }

  /* -------------------------------------------------------------------------- */
  /* Loading & Error States (Requirement 32)                                    */
  /* -------------------------------------------------------------------------- */

  function showLoadingState(isLoading) {
    state.isLoading = isLoading;
    const banner = document.getElementById('backend-loading-banner');
    if (!banner) return;
    if (isLoading) {
      banner.innerHTML = `
        <div class="alert-banner-left">
          <i data-lucide="refresh-cw"></i>
          <span>Loading financial records from backend database...</span>
        </div>
      `;
      banner.classList.remove('hidden');
      refreshIcons();
    } else {
      banner.classList.add('hidden');
      banner.innerHTML = '';
    }
  }

  function showBackendError(message) {
    state.backendError = message;
    const banner = document.getElementById('backend-error-banner');
    if (!banner) return;
    banner.innerHTML = `
      <div class="alert-banner-left">
        <i data-lucide="alert-octagon"></i>
        <span><strong>Backend Connection Error:</strong> ${escapeHtml(message)}</span>
      </div>
      <button type="button" class="alert-banner-link" id="btn-retry-backend">Retry</button>
    `;
    banner.classList.remove('hidden');
    refreshIcons();
    const retryBtn = document.getElementById('btn-retry-backend');
    if (retryBtn) {
      retryBtn.onclick = () => loadStateFromApi();
    }
  }

  function clearBackendError() {
    state.backendError = null;
    const banner = document.getElementById('backend-error-banner');
    if (banner) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
    }
  }

  /* -------------------------------------------------------------------------- */
  /* API Data Layer & One-Time Migration (Requirements 25-28)                   */
  /* -------------------------------------------------------------------------- */

  async function migrateFromLocalStorageIfNeeded() {
    const isMigrated = localStorage.getItem(STORAGE_KEYS.MIGRATED);
    if (isMigrated === 'true') {
      return 0;
    }

    const rawTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    const rawBudget = localStorage.getItem(STORAGE_KEYS.BUDGET);

    let importedCount = 0;
    let localTransactions = [];
    if (rawTx) {
      try {
        localTransactions = JSON.parse(rawTx);
      } catch (_) {}
    }

    // Import transactions if any exist in LocalStorage
    if (Array.isArray(localTransactions) && localTransactions.length > 0) {
      for (const tx of localTransactions) {
        try {
          const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: tx.description || 'Transaction',
              description: tx.description || '',
              amount: Number(tx.amount),
              category: tx.category,
              type: tx.type,
              date: tx.date,
            }),
          });
          if (res.ok) importedCount++;
        } catch (err) {
          console.warn('Failed to migrate transaction:', tx, err);
        }
      }
    }

    // Import budget if any exists in LocalStorage
    if (rawBudget) {
      const budgetNum = Number(rawBudget);
      if (Number.isFinite(budgetNum) && budgetNum > 0) {
        try {
          const [y, m] = getTodayMonthKey().split('-').map(Number);
          await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              year: y,
              month: m,
              amount: budgetNum,
            }),
          });
        } catch (_) {}
      }
    }

    // Set migration flag so this never runs again. Original LocalStorage data is preserved as backup.
    localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    if (importedCount > 0) {
      showToast(`Imported ${importedCount} transactions from LocalStorage to backend database.`);
    }
    return importedCount;
  }

  async function fetchActiveMonthBudget() {
    const [yearStr, monthStr] = state.activeMonth.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);

    try {
      const res = await fetch(`${API_BASE}/budgets/${y}/${m}`);
      if (res.ok) {
        const json = await res.json();
        state.monthlyBudget = Number(json.data.amount);
        state.currentBudgetId = json.data.id;
      } else if (res.status === 404) {
        state.monthlyBudget = 3200;
        state.currentBudgetId = null;
      }
    } catch (err) {
      console.warn('Could not load monthly budget from API:', err);
    }
  }

  async function loadStateFromApi() {
    showLoadingState(true);
    clearBackendError();

    try {
      // 1. One-time migration if needed
      await migrateFromLocalStorageIfNeeded();

      // 2. Fetch all transactions from API
      const txRes = await fetch(`${API_BASE}/transactions`);
      if (!txRes.ok) {
        throw new Error(`Failed to load transactions (HTTP ${txRes.status})`);
      }
      const txJson = await txRes.json();
      state.transactions = Array.isArray(txJson.data) ? txJson.data : [];

      // If database is completely empty on very first fresh run (no localstorage and no db records), seed sample dataset to API
      if (state.transactions.length === 0 && !localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
        const seed = buildSeedTransactions();
        for (const item of seed) {
          try {
            await fetch(`${API_BASE}/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.description,
                description: item.description,
                amount: item.amount,
                category: item.category,
                type: item.type,
                date: item.date,
              }),
            });
          } catch (_) {}
        }
        const [y, m] = getTodayMonthKey().split('-').map(Number);
        try {
          await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: y, month: m, amount: 3200 }),
          });
        } catch (_) {}
        localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');

        // Refetch after seed
        const refetchRes = await fetch(`${API_BASE}/transactions`);
        if (refetchRes.ok) {
          const refetchJson = await refetchRes.json();
          state.transactions = Array.isArray(refetchJson.data) ? refetchJson.data : [];
        }
      }

      // 3. Fetch active month budget
      await fetchActiveMonthBudget();

      showLoadingState(false);
      renderAll();
    } catch (err) {
      console.error('Failed to load state from API:', err);
      showLoadingState(false);
      showBackendError('Unable to connect to the backend server. Please verify the backend is running.');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Derived Financial Calculations                                             */
  /* -------------------------------------------------------------------------- */

  function getAvailableMonthKeys() {
    const set = new Set();
    const current = getTodayMonthKey();
    for (let i = 0; i < 6; i++) {
      set.add(shiftMonthKey(current, -i));
    }
    state.transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        set.add(tx.date.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  function getLastSixMonthKeys(anchorMonthKey) {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push(shiftMonthKey(anchorMonthKey, -i));
    }
    return months;
  }

  function computeMetrics() {
    let totalIncome = 0;
    let totalExpenses = 0;
    let monthIncome = 0;
    let monthExpenses = 0;

    const expenseByCategoryAll = {};
    const expenseByCategoryMonth = {};
    const monthTotalsMap = {};

    state.transactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      const monthKey = tx.date.slice(0, 7);

      if (!monthTotalsMap[monthKey]) {
        monthTotalsMap[monthKey] = { income: 0, expense: 0 };
      }

      if (tx.type === 'income') {
        totalIncome += amount;
        monthTotalsMap[monthKey].income += amount;
        if (monthKey === state.activeMonth) {
          monthIncome += amount;
        }
      } else {
        totalExpenses += amount;
        monthTotalsMap[monthKey].expense += amount;

        if (!expenseByCategoryAll[tx.category]) {
          expenseByCategoryAll[tx.category] = { total: 0, count: 0 };
        }
        expenseByCategoryAll[tx.category].total += amount;
        expenseByCategoryAll[tx.category].count += 1;

        if (monthKey === state.activeMonth) {
          monthExpenses += amount;
          if (!expenseByCategoryMonth[tx.category]) {
            expenseByCategoryMonth[tx.category] = { total: 0, count: 0 };
          }
          expenseByCategoryMonth[tx.category].total += amount;
          expenseByCategoryMonth[tx.category].count += 1;
        }
      }
    });

    const totalBalance = totalIncome - totalExpenses;
    const totalSavings = totalBalance;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const budget = state.monthlyBudget;
    const remainingBudget = budget - monthExpenses;
    const budgetUtilization = budget > 0 ? (monthExpenses / budget) * 100 : 0;

    const activeExpenseMonths = Object.values(monthTotalsMap).filter((m) => m.expense > 0).length;
    const avgMonthlyExpense = activeExpenseMonths > 0 ? totalExpenses / activeExpenseMonths : 0;

    const sortedCategoriesAll = Object.entries(expenseByCategoryAll)
      .map(([category, info]) => ({
        category,
        total: info.total,
        count: info.count,
        share: totalExpenses > 0 ? (info.total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const sortedCategoriesMonth = Object.entries(expenseByCategoryMonth)
      .map(([category, info]) => ({
        category,
        total: info.total,
        count: info.count,
        share: monthExpenses > 0 ? (info.total / monthExpenses) * 100 : 0,
        budgetShare: budget > 0 ? (info.total / budget) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const topCategory = sortedCategoriesAll.length > 0 ? sortedCategoriesAll[0] : null;

    return {
      totalIncome,
      totalExpenses,
      totalBalance,
      totalSavings,
      savingsRate,
      monthIncome,
      monthExpenses,
      monthNet: monthIncome - monthExpenses,
      budget,
      remainingBudget,
      budgetUtilization,
      activeExpenseMonths,
      avgMonthlyExpense,
      monthTotalsMap,
      sortedCategoriesAll,
      sortedCategoriesMonth,
      topCategory,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Toast & Confirmation Modals                                                */
  /* -------------------------------------------------------------------------- */

  function showToast(message, variant = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconName =
      variant === 'danger' ? 'alert-octagon' : variant === 'warning' ? 'alert-triangle' : 'check-circle-2';

    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    refreshIcons();

    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  function openConfirmDialog({ title, message, confirmLabel, onConfirm }) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const acceptBtn = document.getElementById('confirm-accept-btn');
    acceptBtn.textContent = confirmLabel || 'Confirm';

    state.pendingConfirmCallback = onConfirm;
    modal.classList.remove('hidden');
    acceptBtn.focus();
  }

  function closeConfirmDialog() {
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('hidden');
    state.pendingConfirmCallback = null;
  }

  /* -------------------------------------------------------------------------- */
  /* Navigation & Month Picker                                                  */
  /* -------------------------------------------------------------------------- */

  function switchView(viewName) {
    if (!VIEW_META[viewName]) return;
    state.activeView = viewName;

    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });

    document.querySelectorAll('.nav-item[data-nav]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.nav === viewName);
    });

    document.getElementById('topbar-breadcrumb').textContent = VIEW_META[viewName].breadcrumb;
    document.getElementById('topbar-page-title').textContent = VIEW_META[viewName].title;

    closeMobileSidebar();
    renderAll();
  }

  function openMobileSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-backdrop').classList.add('open');
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
  }

  function renderMonthSelector() {
    const select = document.getElementById('global-month-select');
    const months = getAvailableMonthKeys();
    if (!months.includes(state.activeMonth)) {
      state.activeMonth = months[0];
    }

    select.innerHTML = months
      .map(
        (key) =>
          `<option value="${key}" ${key === state.activeMonth ? 'selected' : ''}>${formatMonthLabel(key)}</option>`
      )
      .join('');
  }

  /* -------------------------------------------------------------------------- */
  /* Form Validation & Category Population                                      */
  /* -------------------------------------------------------------------------- */

  function populateCategorySelect(selectEl, type, selectedValue = '') {
    const list = CATEGORIES[type] || CATEGORIES.expense;
    const placeholder = `<option value="">Select category...</option>`;
    const options = list
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${cat === selectedValue ? 'selected' : ''}>${escapeHtml(cat)}</option>`
      )
      .join('');
    selectEl.innerHTML = placeholder + options;
  }

  function setSegmentedType(prefix, typeValue) {
    const hiddenInput = document.getElementById(`${prefix}-type`);
    hiddenInput.value = typeValue;

    document.querySelectorAll(`.segmented-btn[data-type-target="${prefix}"]`).forEach((btn) => {
      const isSelected = btn.dataset.value === typeValue;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    });

    const catSelect = document.getElementById(`${prefix}-category`);
    const prevVal = catSelect.value;
    const allowed = CATEGORIES[typeValue] || [];
    populateCategorySelect(catSelect, typeValue, allowed.includes(prevVal) ? prevVal : '');
    clearFormErrors(prefix);
  }

  function clearFormErrors(prefix) {
    ['amount', 'date', 'category', 'description'].forEach((field) => {
      const input = document.getElementById(`${prefix}-${field}`);
      const err = document.getElementById(`${prefix}-${field}-error`);
      if (input) input.removeAttribute('aria-invalid');
      if (err) err.textContent = '';
    });
  }

  function validateTransactionForm(prefix) {
    clearFormErrors(prefix);

    const type = document.getElementById(`${prefix}-type`).value;
    const amountEl = document.getElementById(`${prefix}-amount`);
    const dateEl = document.getElementById(`${prefix}-date`);
    const categoryEl = document.getElementById(`${prefix}-category`);
    const descEl = document.getElementById(`${prefix}-description`);

    const rawAmount = amountEl.value.trim();
    const amount = Number(rawAmount);
    const dateVal = dateEl.value.trim();
    const categoryVal = categoryEl.value.trim();
    const descVal = descEl.value.trim();

    let isValid = true;

    if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
      amountEl.setAttribute('aria-invalid', 'true');
      document.getElementById(`${prefix}-amount-error`).textContent = 'Enter a valid amount greater than ₹0.00.';
      isValid = false;
    }

    if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      dateEl.setAttribute('aria-invalid', 'true');
      document.getElementById(`${prefix}-date-error`).textContent = 'Select a valid transaction date.';
      isValid = false;
    }

    if (!categoryVal) {
      categoryEl.setAttribute('aria-invalid', 'true');
      document.getElementById(`${prefix}-category-error`).textContent = 'Choose a category.';
      isValid = false;
    }

    if (descVal.length < 2) {
      descEl.setAttribute('aria-invalid', 'true');
      document.getElementById(`${prefix}-description-error`).textContent =
        'Enter a description (at least 2 characters).';
      isValid = false;
    }

    if (!isValid) return null;

    return {
      type: type === 'income' ? 'income' : 'expense',
      amount: Math.round(amount * 100) / 100,
      date: dateVal,
      category: categoryVal,
      description: descVal,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* Transaction CRUD Operations via REST API                                   */
  /* -------------------------------------------------------------------------- */

  async function addTransaction(data) {
    showLoadingState(true);
    clearBackendError();
    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.description || 'Transaction',
          description: data.description,
          amount: data.amount,
          category: data.category,
          type: data.type,
          date: data.date,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const newTx = json.data;
      state.transactions.unshift(newTx);

      const txMonth = newTx.date.slice(0, 7);
      if (state.activeMonth !== txMonth) {
        state.activeMonth = txMonth;
        await fetchActiveMonthBudget();
      }

      showLoadingState(false);
      renderAll();
      showToast(`${newTx.type === 'income' ? 'Income' : 'Expense'} added (${formatCurrency(newTx.amount)}).`);
    } catch (err) {
      showLoadingState(false);
      showToast(`Failed to add transaction: ${err.message}`, 'danger');
    }
  }

  async function updateTransaction(id, data) {
    showLoadingState(true);
    clearBackendError();
    try {
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.description || 'Transaction',
          description: data.description,
          amount: data.amount,
          category: data.category,
          type: data.type,
          date: data.date,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      const updatedTx = json.data;
      const idx = state.transactions.findIndex((t) => String(t.id) === String(id));
      if (idx !== -1) {
        state.transactions[idx] = updatedTx;
      }

      showLoadingState(false);
      renderAll();
      showToast('Transaction updated.');
    } catch (err) {
      showLoadingState(false);
      showToast(`Failed to update transaction: ${err.message}`, 'danger');
    }
  }

  function deleteTransaction(id) {
    const tx = state.transactions.find((t) => String(t.id) === String(id));
    if (!tx) return;

    openConfirmDialog({
      title: 'Delete Transaction',
      message: `Remove "${tx.description || tx.title}" (${formatCurrency(tx.amount)}) from your ledger? This action cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        showLoadingState(true);
        clearBackendError();
        try {
          const res = await fetch(`${API_BASE}/transactions/${id}`, {
            method: 'DELETE',
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          }

          state.transactions = state.transactions.filter((t) => String(t.id) !== String(id));
          showLoadingState(false);
          renderAll();
          showToast('Transaction deleted.', 'warning');
        } catch (err) {
          showLoadingState(false);
          showToast(`Failed to delete transaction: ${err.message}`, 'danger');
        }
      },
    });
  }

  function openTransactionModal(txToEdit = null) {
    const modal = document.getElementById('transaction-modal');
    const titleEl = document.getElementById('modal-title');
    const submitBtn = document.getElementById('modal-submit-btn');
    const idInput = document.getElementById('modal-tx-id');

    clearFormErrors('modal');

    if (txToEdit) {
      titleEl.textContent = 'Edit Transaction';
      submitBtn.textContent = 'Update Transaction';
      idInput.value = txToEdit.id;
      setSegmentedType('modal', txToEdit.type);
      document.getElementById('modal-amount').value = txToEdit.amount.toFixed(2);
      document.getElementById('modal-date').value = txToEdit.date;
      document.getElementById('modal-category').value = txToEdit.category;
      document.getElementById('modal-description').value = txToEdit.description;
    } else {
      titleEl.textContent = 'Add Transaction';
      submitBtn.textContent = 'Save Transaction';
      idInput.value = '';
      setSegmentedType('modal', 'expense');
      document.getElementById('modal-amount').value = '';
      document.getElementById('modal-date').value = getTodayDateString();
      document.getElementById('modal-category').value = '';
      document.getElementById('modal-description').value = '';
    }

    modal.classList.remove('hidden');
    document.getElementById('modal-amount').focus();
  }

  function closeTransactionModal() {
    document.getElementById('transaction-modal').classList.add('hidden');
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Global Budget Banner & Sidebar Mini Budget                      */
  /* -------------------------------------------------------------------------- */

  function renderBudgetIndicators(metrics) {
    const { budget, monthExpenses, remainingBudget, budgetUtilization } = metrics;
    const clampedPct = Math.min(budgetUtilization, 100);

    // Sidebar mini widget
    const sidebarPctEl = document.getElementById('sidebar-budget-pct');
    const sidebarBarEl = document.getElementById('sidebar-budget-bar');
    const sidebarMetaEl = document.getElementById('sidebar-budget-meta');

    sidebarPctEl.textContent = `${budgetUtilization.toFixed(0)}%`;
    sidebarBarEl.style.width = `${clampedPct}%`;
    sidebarBarEl.className = 'progress-fill';
    if (budgetUtilization >= 100) {
      sidebarBarEl.classList.add('status-danger');
      sidebarPctEl.className = 'sidebar-budget-pct mono text-danger';
    } else if (budgetUtilization >= 80) {
      sidebarBarEl.classList.add('status-warning');
      sidebarPctEl.className = 'sidebar-budget-pct mono text-warning';
    } else {
      sidebarPctEl.className = 'sidebar-budget-pct mono';
    }
    sidebarMetaEl.textContent = `${formatCurrency(monthExpenses)} / ${formatCurrency(budget)}`;

    // Global Banner on Dashboard & Budget Views
    const bannerEl = document.getElementById('budget-alert-banner');
    const showOnView = state.activeView === 'dashboard' || state.activeView === 'budget';

    if (showOnView && budgetUtilization >= 100) {
      const overAmount = Math.abs(remainingBudget);
      bannerEl.className = 'alert-banner danger';
      bannerEl.innerHTML = `
        <div class="alert-banner-left">
          <i data-lucide="alert-octagon"></i>
          <span><strong>Budget Exceeded (${budgetUtilization.toFixed(1)}%):</strong> Spending for ${formatMonthLabel(
        state.activeMonth
      )} has exceeded your ${formatCurrency(budget)} limit by ${formatCurrency(overAmount)}.</span>
        </div>
        ${
          state.activeView !== 'budget'
            ? '<button type="button" class="alert-banner-link" data-nav-trigger="budget">Review Budget</button>'
            : ''
        }
      `;
    } else if (showOnView && budgetUtilization >= 80) {
      bannerEl.className = 'alert-banner warning';
      bannerEl.innerHTML = `
        <div class="alert-banner-left">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Budget Warning (${budgetUtilization.toFixed(1)}%):</strong> You have used over 80% of your ${formatMonthLabel(
        state.activeMonth
      )} budget. ${formatCurrency(remainingBudget)} remaining.</span>
        </div>
        ${
          state.activeView !== 'budget'
            ? '<button type="button" class="alert-banner-link" data-nav-trigger="budget">Adjust Budget</button>'
            : ''
        }
      `;
    } else {
      bannerEl.className = 'alert-banner hidden';
      bannerEl.innerHTML = '';
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Dashboard View                                                  */
  /* -------------------------------------------------------------------------- */

  function renderDashboard(metrics) {
    const balEl = document.getElementById('kpi-total-balance');
    balEl.textContent = formatCurrency(metrics.totalBalance);
    balEl.className = `kpi-value mono ${metrics.totalBalance < 0 ? 'text-danger' : ''}`;

    document.getElementById('kpi-balance-subtext').textContent =
      metrics.totalBalance >= 0 ? 'Net positive lifetime cashflow' : 'Expenses exceed lifetime income';

    document.getElementById('kpi-total-income').textContent = formatCurrency(metrics.totalIncome);
    document.getElementById('kpi-income-subtext').textContent = `${formatCurrency(
      metrics.monthIncome
    )} in ${formatShortMonthLabel(state.activeMonth)}`;

    document.getElementById('kpi-total-expenses').textContent = formatCurrency(metrics.totalExpenses);
    document.getElementById('kpi-expenses-subtext').textContent = `${formatCurrency(
      metrics.monthExpenses
    )} in ${formatShortMonthLabel(state.activeMonth)}`;

    document.getElementById('kpi-monthly-spending').textContent = formatCurrency(metrics.monthExpenses);
    const pctStr = metrics.budgetUtilization.toFixed(1);
    document.getElementById('kpi-monthly-subtext').textContent = `${pctStr}% of ${formatCurrency(
      metrics.budget
    )} budget`;

    document.getElementById('dash-category-subtitle').textContent = `${formatMonthLabel(
      state.activeMonth
    )} distribution`;

    // Recent Transactions Table (top 6 sorted newest first)
    const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 6);
    const tbody = document.getElementById('recent-transactions-body');
    const emptyEl = document.getElementById('recent-empty-state');

    if (recent.length === 0) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      tbody.innerHTML = recent
        .map((tx) => {
          const isIncome = tx.type === 'income';
          const sign = isIncome ? '+' : '-';
          return `
            <tr>
              <td class="cell-date">${formatDateDisplay(tx.date)}</td>
              <td class="cell-desc">${escapeHtml(tx.description)}</td>
              <td class="cell-category">${escapeHtml(tx.category)}</td>
              <td>
                <span class="cell-type ${isIncome ? 'cell-type-income' : 'cell-type-expense'}">
                  <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}"></i>
                  <span>${isIncome ? 'Income' : 'Expense'}</span>
                </span>
              </td>
              <td class="cell-amount ${isIncome ? 'text-income' : 'text-expense'}">${sign}${formatCurrency(
            tx.amount
          )}</td>
            </tr>
          `;
        })
        .join('');
    }

    renderDashboardCharts(metrics);
  }

  function renderDashboardCharts(metrics) {
    if (typeof window.Chart === 'undefined') return;

    // 1. Monthly Spending Overview (6 months bar chart)
    const monthKeys = getLastSixMonthKeys(state.activeMonth);
    const labels = monthKeys.map(formatShortMonthLabel);
    const expenseValues = monthKeys.map((k) => (metrics.monthTotalsMap[k] ? metrics.monthTotalsMap[k].expense : 0));

    const ctxOverview = document.getElementById('chart-monthly-overview').getContext('2d');
    if (state.charts.monthlyOverview) {
      state.charts.monthlyOverview.destroy();
    }

    state.charts.monthlyOverview = new window.Chart(ctxOverview, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly Spending',
            data: expenseValues,
            backgroundColor: monthKeys.map((k) => (k === state.activeMonth ? '#0f172a' : '#cbd5e1')),
            borderRadius: 6,
            maxBarThickness: 42,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 220 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            callbacks: {
              label: (ctx) => ` Spending: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'IBM Plex Mono', size: 11 } },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#64748b',
              font: { family: 'IBM Plex Mono', size: 11 },
              callback: (v) => `₹${Number(v).toLocaleString('en-IN')}`,
            },
          },
        },
      },
    });

    // 2. Dashboard Expense Category Breakdown (Selected Month Doughnut)
    const cats = metrics.sortedCategoriesMonth;
    const emptyCatEl = document.getElementById('dash-category-empty');
    const legendEl = document.getElementById('dash-category-legend');
    const canvasCat = document.getElementById('chart-dash-categories');

    if (state.charts.dashCategories) {
      state.charts.dashCategories.destroy();
      state.charts.dashCategories = null;
    }

    if (cats.length === 0) {
      emptyCatEl.classList.remove('hidden');
      canvasCat.style.opacity = '0';
      legendEl.innerHTML = '';
    } else {
      emptyCatEl.classList.add('hidden');
      canvasCat.style.opacity = '1';

      state.charts.dashCategories = new window.Chart(canvasCat.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: cats.map((c) => c.category),
          datasets: [
            {
              data: cats.map((c) => c.total),
              backgroundColor: cats.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]),
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          animation: { duration: 220 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const item = cats[ctx.dataIndex];
                  return ` ${item.category}: ${formatCurrency(item.total)} (${item.share.toFixed(1)}%)`;
                },
              },
            },
          },
        },
      });

      legendEl.innerHTML = cats
        .slice(0, 5)
        .map(
          (c, idx) => `
          <li class="legend-row">
            <div class="legend-label-wrap">
              <span class="legend-swatch" style="background-color: ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}"></span>
              <span class="legend-name">${escapeHtml(c.category)}</span>
            </div>
            <span class="legend-amount">${formatCurrency(c.total)} · ${c.share.toFixed(0)}%</span>
          </li>
        `
        )
        .join('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Income & Expense Management View                                */
  /* -------------------------------------------------------------------------- */

  function renderManageView(metrics) {
    document.getElementById('manage-month-label').textContent = formatMonthLabel(state.activeMonth);
    document.getElementById('manage-month-income').textContent = formatCurrency(metrics.monthIncome);
    document.getElementById('manage-month-expenses').textContent = formatCurrency(metrics.monthExpenses);

    const netEl = document.getElementById('manage-month-net');
    netEl.textContent = formatCurrency(metrics.monthNet);
    netEl.className = `mono ${metrics.monthNet >= 0 ? 'text-income' : 'text-danger'}`;

    const listEl = document.getElementById('manage-recent-list');
    const latest = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    if (latest.length === 0) {
      listEl.innerHTML = '<li class="mini-tx-meta" style="padding: 8px 0;">No entries recorded yet.</li>';
    } else {
      listEl.innerHTML = latest
        .map((tx) => {
          const isIncome = tx.type === 'income';
          return `
            <li class="mini-tx-item">
              <div class="mini-tx-info">
                <p class="mini-tx-title">${escapeHtml(tx.description)}</p>
                <p class="mini-tx-meta">${escapeHtml(tx.category)} · ${formatDateDisplay(tx.date)}</p>
              </div>
              <span class="mini-tx-amount ${isIncome ? 'text-income' : 'text-expense'}">
                ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
              </span>
            </li>
          `;
        })
        .join('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Transaction History View                                        */
  /* -------------------------------------------------------------------------- */

  function getFilteredTransactions() {
    const query = state.filters.search.trim().toLowerCase();

    const filtered = state.transactions.filter((tx) => {
      if (state.filters.type !== 'all' && tx.type !== state.filters.type) return false;
      if (state.filters.category !== 'all' && tx.category !== state.filters.category) return false;
      if (query) {
        const matchDesc = tx.description.toLowerCase().includes(query);
        const matchCat = tx.category.toLowerCase().includes(query);
        if (!matchDesc && !matchCat) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (state.filters.sort) {
        case 'date-asc':
          return a.date.localeCompare(b.date);
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        case 'date-desc':
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return filtered;
  }

  function renderHistoryCategoryOptions() {
    const select = document.getElementById('history-category-filter');
    const currentVal = state.filters.category;
    const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];

    select.innerHTML =
      `<option value="all">All Categories</option>` +
      allCats
        .map(
          (c) =>
            `<option value="${escapeHtml(c)}" ${c === currentVal ? 'selected' : ''}>${escapeHtml(c)}</option>`
        )
        .join('');
  }

  function renderHistoryView() {
    renderHistoryCategoryOptions();

    const filtered = getFilteredTransactions();
    const tbody = document.getElementById('history-table-body');
    const emptyEl = document.getElementById('history-empty-state');
    const metaEl = document.getElementById('history-results-meta');

    const totalNet = filtered.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
    metaEl.textContent = `Showing ${filtered.length} of ${state.transactions.length} transactions · Net: ${formatCurrency(
      totalNet
    )}`;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      emptyEl.classList.remove('hidden');
      const hasAny = state.transactions.length > 0;
      document.getElementById('history-empty-title').textContent = hasAny
        ? 'No matching transactions'
        : 'Your transaction ledger is empty';
      document.getElementById('history-empty-desc').textContent = hasAny
        ? 'Adjust your search query, type toggle, or category filter.'
        : 'Add an income or expense entry to begin tracking your cashflow.';
      document.getElementById('btn-reset-filters').classList.toggle('hidden', !hasAny);
    } else {
      emptyEl.classList.add('hidden');
      tbody.innerHTML = filtered
        .map((tx) => {
          const isIncome = tx.type === 'income';
          const sign = isIncome ? '+' : '-';
          return `
            <tr>
              <td class="cell-date">${formatDateDisplay(tx.date)}</td>
              <td class="cell-desc">${escapeHtml(tx.description)}</td>
              <td class="cell-category">${escapeHtml(tx.category)}</td>
              <td>
                <span class="cell-type ${isIncome ? 'cell-type-income' : 'cell-type-expense'}">
                  <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}"></i>
                  <span>${isIncome ? 'Income' : 'Expense'}</span>
                </span>
              </td>
              <td class="cell-amount ${isIncome ? 'text-income' : 'text-expense'}">${sign}${formatCurrency(
            tx.amount
          )}</td>
              <td class="cell-actions">
                <div class="table-action-group">
                  <button
                    type="button"
                    class="table-icon-btn"
                    data-edit-id="${escapeHtml(tx.id)}"
                    aria-label="Edit ${escapeHtml(tx.description)}"
                    title="Edit transaction"
                  >
                    <i data-lucide="pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="table-icon-btn danger"
                    data-delete-id="${escapeHtml(tx.id)}"
                    aria-label="Delete ${escapeHtml(tx.description)}"
                    title="Delete transaction"
                  >
                    <i data-lucide="trash-2"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Expense Analytics View                                          */
  /* -------------------------------------------------------------------------- */

  function renderAnalyticsView(metrics) {
    const savingsEl = document.getElementById('analytics-total-savings');
    savingsEl.textContent = formatCurrency(metrics.totalSavings);
    savingsEl.className = `kpi-value mono ${metrics.totalSavings < 0 ? 'text-danger' : 'text-income'}`;

    document.getElementById('analytics-savings-rate').textContent = `${metrics.savingsRate.toFixed(
      1
    )}% overall savings rate`;

    if (metrics.topCategory) {
      document.getElementById('analytics-top-category').textContent = metrics.topCategory.category;
      document.getElementById('analytics-top-category-meta').textContent = `${formatCurrency(
        metrics.topCategory.total
      )} · ${metrics.topCategory.share.toFixed(1)}% of expenses`;
    } else {
      document.getElementById('analytics-top-category').textContent = '—';
      document.getElementById('analytics-top-category-meta').textContent = 'No expense data recorded';
    }

    document.getElementById('analytics-avg-monthly').textContent = formatCurrency(metrics.avgMonthlyExpense);
    document.getElementById('analytics-active-months').textContent = `Across ${
      metrics.activeExpenseMonths
    } active month${metrics.activeExpenseMonths === 1 ? '' : 's'}`;

    const monthNetEl = document.getElementById('analytics-month-net');
    monthNetEl.textContent = formatCurrency(metrics.monthNet);
    monthNetEl.className = `kpi-value mono ${metrics.monthNet < 0 ? 'text-danger' : ''}`;
    document.getElementById('analytics-month-net-label').textContent = `${formatMonthLabel(
      state.activeMonth
    )} cashflow`;

    // Category Allocation Table
    const tableBody = document.getElementById('analytics-category-table-body');
    if (metrics.sortedCategoriesAll.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No expense categories to display.</td></tr>';
    } else {
      tableBody.innerHTML = metrics.sortedCategoriesAll
        .map(
          (item) => `
          <tr>
            <td class="cell-desc">${escapeHtml(item.category)}</td>
            <td class="text-right mono">${item.count}</td>
            <td class="text-right mono" style="font-weight:600;">${formatCurrency(item.total)}</td>
            <td class="text-right">
              <div class="inline-share-wrap">
                <div class="inline-share-bar">
                  <div class="inline-share-fill" style="width:${item.share.toFixed(1)}%"></div>
                </div>
                <span class="mono">${item.share.toFixed(1)}%</span>
              </div>
            </td>
          </tr>
        `
        )
        .join('');
    }

    renderAnalyticsCharts(metrics);
  }

  function renderAnalyticsCharts(metrics) {
    if (typeof window.Chart === 'undefined') return;

    // 1. Monthly Income vs. Expenses (Grouped Bar)
    const monthKeys = getLastSixMonthKeys(state.activeMonth);
    const labels = monthKeys.map(formatShortMonthLabel);
    const incomeSeries = monthKeys.map((k) => (metrics.monthTotalsMap[k] ? metrics.monthTotalsMap[k].income : 0));
    const expenseSeries = monthKeys.map((k) => (metrics.monthTotalsMap[k] ? metrics.monthTotalsMap[k].expense : 0));

    if (state.charts.incomeVsExpense) {
      state.charts.incomeVsExpense.destroy();
    }
    state.charts.incomeVsExpense = new window.Chart(
      document.getElementById('chart-income-vs-expense').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Income',
              data: incomeSeries,
              backgroundColor: '#16a34a',
              borderRadius: 5,
              maxBarThickness: 26,
            },
            {
              label: 'Expenses',
              data: expenseSeries,
              backgroundColor: '#0f172a',
              borderRadius: 5,
              maxBarThickness: 26,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 220 },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 12 } },
            },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', font: { family: 'IBM Plex Mono', size: 11 } },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: '#f1f5f9' },
              ticks: {
                color: '#64748b',
                font: { family: 'IBM Plex Mono', size: 11 },
                callback: (v) => `₹${Number(v).toLocaleString('en-IN')}`,
              },
            },
          },
        },
      }
    );

    // 2. Category-Wise Expense Breakdown (Horizontal Bar)
    const cats = metrics.sortedCategoriesAll;
    if (state.charts.categoryBars) {
      state.charts.categoryBars.destroy();
    }
    state.charts.categoryBars = new window.Chart(
      document.getElementById('chart-category-bars').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: cats.map((c) => c.category),
          datasets: [
            {
              label: 'Total Spent',
              data: cats.map((c) => c.total),
              backgroundColor: cats.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
              borderRadius: 5,
              maxBarThickness: 24,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 220 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              callbacks: {
                label: (ctx) => ` Spent: ${formatCurrency(ctx.parsed.x)}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: '#f1f5f9' },
              ticks: {
                color: '#64748b',
                font: { family: 'IBM Plex Mono', size: 11 },
                callback: (v) => `₹${Number(v).toLocaleString('en-IN')}`,
              },
            },
            y: {
              grid: { display: false },
              ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11.5 } },
            },
          },
        },
      }
    );

    // 3. Spending Distribution Doughnut
    const distCanvas = document.getElementById('chart-spending-distribution');
    const distEmpty = document.getElementById('analytics-dist-empty');

    if (state.charts.spendingDistribution) {
      state.charts.spendingDistribution.destroy();
      state.charts.spendingDistribution = null;
    }

    if (cats.length === 0) {
      distEmpty.classList.remove('hidden');
      distCanvas.style.opacity = '0';
    } else {
      distEmpty.classList.add('hidden');
      distCanvas.style.opacity = '1';

      state.charts.spendingDistribution = new window.Chart(distCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: cats.map((c) => c.category),
          datasets: [
            {
              data: cats.map((c) => c.total),
              backgroundColor: cats.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]),
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          animation: { duration: 220 },
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, padding: 12, font: { family: 'Plus Jakarta Sans', size: 11.5 } },
            },
            tooltip: {
              backgroundColor: '#0f172a',
              padding: 10,
              callbacks: {
                label: (ctx) => {
                  const item = cats[ctx.dataIndex];
                  return ` ${item.category}: ${formatCurrency(item.total)} (${item.share.toFixed(1)}%)`;
                },
              },
            },
          },
        },
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Rendering: Budget Management View                                          */
  /* -------------------------------------------------------------------------- */

  function renderBudgetView(metrics) {
    const { budget, monthExpenses, remainingBudget, budgetUtilization, sortedCategoriesMonth } = metrics;
    const clampedPct = Math.min(budgetUtilization, 100);

    document.getElementById('budget-month-subtitle').textContent = `Tracking expenses for ${formatMonthLabel(
      state.activeMonth
    )}`;
    document.getElementById('budget-limit-display').textContent = formatCurrency(budget);
    document.getElementById('budget-spent-display').textContent = formatCurrency(monthExpenses);

    const remainingEl = document.getElementById('budget-remaining-display');
    remainingEl.textContent = formatCurrency(remainingBudget);
    remainingEl.className = `budget-metric-value mono ${
      remainingBudget < 0 ? 'text-danger' : remainingBudget === 0 ? '' : 'text-income'
    }`;

    document.getElementById('budget-utilization-display').textContent = `${budgetUtilization.toFixed(1)}%`;

    const barEl = document.getElementById('budget-main-progress-bar');
    barEl.style.width = `${clampedPct}%`;
    barEl.className = 'progress-fill';

    const stateLabel = document.getElementById('budget-state-label');
    const feedbackBox = document.getElementById('budget-threshold-feedback');

    if (budgetUtilization >= 100) {
      barEl.classList.add('status-danger');
      stateLabel.textContent = 'Budget Exceeded';
      stateLabel.className = 'budget-state-text text-danger';
      feedbackBox.className = 'budget-feedback-box status-danger';
      feedbackBox.innerHTML = `
        <i data-lucide="alert-octagon"></i>
        <span><strong>Alert:</strong> You have exceeded your monthly budget of ${formatCurrency(
          budget
        )} by <strong>${formatCurrency(Math.abs(remainingBudget))}</strong> (${budgetUtilization.toFixed(
        1
      )}% utilized). Consider reviewing discretionary categories below.</span>
      `;
    } else if (budgetUtilization >= 80) {
      barEl.classList.add('status-warning');
      stateLabel.textContent = 'Approaching Limit';
      stateLabel.className = 'budget-state-text text-warning';
      feedbackBox.className = 'budget-feedback-box status-warning';
      feedbackBox.innerHTML = `
        <i data-lucide="alert-triangle"></i>
        <span><strong>Warning (80%+ Threshold):</strong> You have consumed <strong>${budgetUtilization.toFixed(
          1
        )}%</strong> of your monthly budget. Only <strong>${formatCurrency(
        remainingBudget
      )}</strong> remains for the rest of ${formatMonthLabel(state.activeMonth)}.</span>
      `;
    } else {
      stateLabel.textContent = 'On Track';
      stateLabel.className = 'budget-state-text text-income';
      feedbackBox.className = 'budget-feedback-box status-nominal';
      feedbackBox.innerHTML = `
        <i data-lucide="check-circle-2"></i>
        <span><strong>Healthy Pace:</strong> You have used ${budgetUtilization.toFixed(
          1
        )}% of your monthly budget, leaving <strong>${formatCurrency(remainingBudget)}</strong> available for ${formatMonthLabel(
        state.activeMonth
      )}.</span>
      `;
    }

    document.getElementById('budget-amount-input').value = budget;

    // Category impact table for selected month
    const impactBody = document.getElementById('budget-category-impact-body');
    if (sortedCategoriesMonth.length === 0) {
      impactBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">No expenses recorded in ${formatMonthLabel(
        state.activeMonth
      )}.</td></tr>`;
    } else {
      impactBody.innerHTML = sortedCategoriesMonth
        .map(
          (c) => `
          <tr>
            <td class="cell-desc">${escapeHtml(c.category)}</td>
            <td class="text-right mono">${c.count}</td>
            <td class="text-right mono" style="font-weight:600;">${formatCurrency(c.total)}</td>
            <td class="text-right mono">${c.budgetShare.toFixed(1)}%</td>
          </tr>
        `
        )
        .join('');
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Master Render                                                              */
  /* -------------------------------------------------------------------------- */

  function renderAll() {
    renderMonthSelector();
    const metrics = computeMetrics();
    renderBudgetIndicators(metrics);

    if (state.activeView === 'dashboard') {
      renderDashboard(metrics);
    } else if (state.activeView === 'manage') {
      renderManageView(metrics);
    } else if (state.activeView === 'history') {
      renderHistoryView();
    } else if (state.activeView === 'analytics') {
      renderAnalyticsView(metrics);
    } else if (state.activeView === 'budget') {
      renderBudgetView(metrics);
    }

    refreshIcons();
  }

  /* -------------------------------------------------------------------------- */
  /* CSV Export                                                                 */
  /* -------------------------------------------------------------------------- */

  function exportTransactionsToCsv(txList) {
    if (!txList.length) {
      showToast('No transactions available to export.', 'warning');
      return;
    }

    const header = ['Date', 'Type', 'Category', 'Description', 'Amount'];
    const rows = txList.map((tx) => [
      tx.date,
      tx.type,
      `"${String(tx.category).replace(/"/g, '""')}"`,
      `"${String(tx.description).replace(/"/g, '""')}"`,
      tx.amount.toFixed(2),
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `clearledger-transactions-${getTodayDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast(`Exported ${txList.length} transactions to CSV.`);
  }

  /* -------------------------------------------------------------------------- */
  /* Event Binding                                                              */
  /* -------------------------------------------------------------------------- */

  function bindEvents() {
    // Sidebar & nav triggers
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(el.dataset.nav);
      });
    });

    document.addEventListener('click', (e) => {
      const navTrigger = e.target.closest('[data-nav-trigger]');
      if (navTrigger) {
        switchView(navTrigger.dataset.navTrigger);
        return;
      }

      const editBtn = e.target.closest('[data-edit-id]');
      if (editBtn) {
        const tx = state.transactions.find((t) => String(t.id) === String(editBtn.dataset.editId));
        if (tx) openTransactionModal(tx);
        return;
      }

      const deleteBtn = e.target.closest('[data-delete-id]');
      if (deleteBtn) {
        deleteTransaction(deleteBtn.dataset.deleteId);
      }
    });

    // Mobile sidebar controls
    document.getElementById('sidebar-open-btn').addEventListener('click', openMobileSidebar);
    document.getElementById('sidebar-close-btn').addEventListener('click', closeMobileSidebar);
    document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

    // Global month picker
    document.getElementById('global-month-select').addEventListener('change', async (e) => {
      state.activeMonth = e.target.value;
      await fetchActiveMonthBudget();
      renderAll();
    });

    // Quick Add Modal triggers
    document.getElementById('btn-quick-add').addEventListener('click', () => openTransactionModal(null));
    document.getElementById('btn-empty-add-dash').addEventListener('click', () => openTransactionModal(null));

    // Modal controls
    document.getElementById('modal-close-btn').addEventListener('click', closeTransactionModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeTransactionModal);
    document.getElementById('transaction-modal').addEventListener('click', (e) => {
      if (e.target.id === 'transaction-modal') closeTransactionModal();
    });

    // Confirm Modal controls
    document.getElementById('confirm-close-btn').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-accept-btn').addEventListener('click', () => {
      const cb = state.pendingConfirmCallback;
      closeConfirmDialog();
      if (typeof cb === 'function') cb();
    });
    document.getElementById('confirm-modal').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-modal') closeConfirmDialog();
    });

    // Escape key closes open modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTransactionModal();
        closeConfirmDialog();
        closeMobileSidebar();
      }
    });

    // Segmented type switches (inline & modal)
    document.querySelectorAll('.segmented-btn[data-type-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setSegmentedType(btn.dataset.typeTarget, btn.dataset.value);
      });
    });

    // Inline Transaction Form Submit & Reset
    const inlineForm = document.getElementById('inline-transaction-form');
    inlineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const validated = validateTransactionForm('inline');
      if (!validated) return;

      addTransaction(validated);
      inlineForm.reset();
      setSegmentedType('inline', 'expense');
      document.getElementById('inline-date').value = getTodayDateString();
    });

    document.getElementById('inline-reset-btn').addEventListener('click', () => {
      setTimeout(() => {
        clearFormErrors('inline');
        setSegmentedType('inline', 'expense');
        document.getElementById('inline-date').value = getTodayDateString();
      }, 0);
    });

    // Modal Transaction Form Submit
    document.getElementById('modal-transaction-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const validated = validateTransactionForm('modal');
      if (!validated) return;

      const editId = document.getElementById('modal-tx-id').value;
      if (editId) {
        updateTransaction(editId, validated);
      } else {
        addTransaction(validated);
      }
      closeTransactionModal();
    });

    // History Filters & Search
    document.getElementById('history-search').addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderHistoryView();
      refreshIcons();
    });

    document.querySelectorAll('.segmented-btn[data-history-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filters.type = btn.dataset.historyType;
        document.querySelectorAll('.segmented-btn[data-history-type]').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        renderHistoryView();
        refreshIcons();
      });
    });

    document.getElementById('history-category-filter').addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      renderHistoryView();
      refreshIcons();
    });

    document.getElementById('history-sort').addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      renderHistoryView();
      refreshIcons();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      state.filters = { search: '', type: 'all', category: 'all', sort: 'date-desc' };
      document.getElementById('history-search').value = '';
      document.getElementById('history-category-filter').value = 'all';
      document.getElementById('history-sort').value = 'date-desc';
      document.querySelectorAll('.segmented-btn[data-history-type]').forEach((b) => {
        b.classList.toggle('active', b.dataset.historyType === 'all');
      });
      renderHistoryView();
      refreshIcons();
    });

    // Budget Form & Presets
    document.getElementById('budget-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('budget-amount-input');
      const errEl = document.getElementById('budget-amount-error');
      const val = Number(input.value);

      input.removeAttribute('aria-invalid');
      errEl.textContent = '';

      if (!input.value.trim() || !Number.isFinite(val) || val <= 0) {
        input.setAttribute('aria-invalid', 'true');
        errEl.textContent = 'Enter a monthly budget greater than ₹0.';
        return;
      }

      const newLimit = Math.round(val * 100) / 100;
      const [yearStr, monthStr] = state.activeMonth.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);

      showLoadingState(true);
      clearBackendError();
      try {
        if (state.currentBudgetId) {
          const res = await fetch(`${API_BASE}/budgets/${state.currentBudgetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: newLimit }),
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          }
          const json = await res.json();
          state.monthlyBudget = Number(json.data.amount);
        } else {
          const res = await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: y, month: m, amount: newLimit }),
          });
          if (res.status === 409) {
            const getRes = await fetch(`${API_BASE}/budgets/${y}/${m}`);
            if (getRes.ok) {
              const getJson = await getRes.json();
              state.currentBudgetId = getJson.data.id;
              const putRes = await fetch(`${API_BASE}/budgets/${state.currentBudgetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: newLimit }),
              });
              const putJson = await putRes.json();
              state.monthlyBudget = Number(putJson.data.amount);
            }
          } else if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          } else {
            const json = await res.json();
            state.monthlyBudget = Number(json.data.amount);
            state.currentBudgetId = json.data.id;
          }
        }

        showLoadingState(false);
        renderAll();
        showToast(`Monthly budget updated to ${formatCurrency(state.monthlyBudget)}.`);
      } catch (err) {
        showLoadingState(false);
        showToast(`Failed to update budget: ${err.message}`, 'danger');
      }
    });

    document.querySelectorAll('[data-budget-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('budget-amount-input').value = btn.dataset.budgetPreset;
        document.getElementById('budget-amount-error').textContent = '';
        document.getElementById('budget-amount-input').removeAttribute('aria-invalid');
      });
    });

    // Export CSV buttons
    document.getElementById('btn-export-csv-sidebar').addEventListener('click', () => {
      exportTransactionsToCsv(state.transactions);
    });
    document.getElementById('btn-export-csv-history').addEventListener('click', () => {
      exportTransactionsToCsv(getFilteredTransactions());
    });

    // Clear All & Reset Sample Data
    document.getElementById('btn-clear-all').addEventListener('click', () => {
      if (state.transactions.length === 0) {
        showToast('Your ledger is already empty.', 'warning');
        return;
      }
      openConfirmDialog({
        title: 'Clear All Transactions',
        message: 'Delete every transaction stored in your database? Your monthly budget limit will be preserved.',
        confirmLabel: 'Clear All',
        onConfirm: async () => {
          showLoadingState(true);
          try {
            for (const tx of [...state.transactions]) {
              await fetch(`${API_BASE}/transactions/${tx.id}`, { method: 'DELETE' });
            }
            state.transactions = [];
            showLoadingState(false);
            renderAll();
            showToast('All transactions cleared.', 'warning');
          } catch (err) {
            showLoadingState(false);
            showToast('Failed to clear all transactions from database.', 'danger');
          }
        },
      });
    });

    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      openConfirmDialog({
        title: 'Reset Sample Data',
        message: 'Replace current entries with the default 6-month sample financial dataset in the backend database?',
        confirmLabel: 'Restore Sample Data',
        onConfirm: async () => {
          showLoadingState(true);
          try {
            // Delete existing transactions
            for (const tx of [...state.transactions]) {
              await fetch(`${API_BASE}/transactions/${tx.id}`, { method: 'DELETE' });
            }
            // Seed 6-month sample transactions
            const seed = buildSeedTransactions();
            for (const item of seed) {
              await fetch(`${API_BASE}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: item.description,
                  description: item.description,
                  amount: item.amount,
                  category: item.category,
                  type: item.type,
                  date: item.date,
                }),
              });
            }
            state.activeMonth = getTodayMonthKey();
            const [y, m] = state.activeMonth.split('-').map(Number);
            if (state.currentBudgetId) {
              await fetch(`${API_BASE}/budgets/${state.currentBudgetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: 3200 }),
              });
            } else {
              const bRes = await fetch(`${API_BASE}/budgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: y, month: m, amount: 3200 }),
              });
              if (bRes.ok) {
                const bJson = await bRes.json();
                state.currentBudgetId = bJson.data.id;
              }
            }
            state.monthlyBudget = 3200;

            const txRes = await fetch(`${API_BASE}/transactions`);
            const txJson = await txRes.json();
            state.transactions = Array.isArray(txJson.data) ? txJson.data : [];

            showLoadingState(false);
            renderAll();
            showToast('Sample financial dataset restored.');
          } catch (err) {
            showLoadingState(false);
            showToast('Failed to reset sample data in database.', 'danger');
          }
        },
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Bootstrap                                                                  */
  /* -------------------------------------------------------------------------- */

  async function init() {
    // Initialize inline form defaults
    setSegmentedType('inline', 'expense');
    document.getElementById('inline-date').value = getTodayDateString();
    document.getElementById('modal-date').value = getTodayDateString();

    bindEvents();
    await loadStateFromApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
