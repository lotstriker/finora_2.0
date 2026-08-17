// ============================================
// FINORA — Dashboard (v2.0) — FIXED
// ============================================

async function loadDashboard() {
    const container = document.getElementById('pageContainer');
    const db = getDB();  // ✅ FIXED: db defined here

    try {
        const totalBalance = await getTotalBalance();
        const monthlySummary = await getPeriodSummary(
            getMonthStart(new Date()),
            getMonthEnd(new Date())
        );

        // Committees
        const committees = await db.readAll('committees');
        let committeeGain = 0;
        let activeCommittees = 0;
        let currentContribution = 0;
        const currentMonth = getCurrentMonth();

        for (const c of committees) {
            if (c.status === 'active') {
                activeCommittees++;
                committeeGain += c.totalGain || 0;

                // Find current month's cycle
                const cycles = await getCommitteeCycles(c.id);
                const currentCycle = cycles.find(cy => 
                    getMonthYear(cy.month) === currentMonth && cy.status === 'pending'
                );
                if (currentCycle) {
                    currentContribution += currentCycle.payable || 0;
                }
            }
        }

        // Loans
        const loans = await db.readAll('loans');
        const activeLoans = loans.filter(l => l.status === 'active');
        const nextEMI = activeLoans.reduce((min, l) => {
            const emi = l.monthlyEMI || 0;
            return emi < min ? emi : min;
        }, Infinity);

        // Savings
        const savingsGoals = await db.readAll('savings_goals');
        const activeSavings = savingsGoals.filter(g => g.status === 'active');
        let totalSaved = 0;
        let savingsProgress = 0;

        for (const goal of activeSavings) {
            const contributions = await getSavingsContributions(goal.id);
            const saved = contributions.reduce((s, c) => s + c.amount, 0);
            totalSaved += saved;
            if (goal.target > 0) {
                savingsProgress += (saved / goal.target) * 100;
            }
        }
        if (activeSavings.length > 0) {
            savingsProgress = Math.round(savingsProgress / activeSavings.length);
        }

        // Recent Transactions
        const recentTxns = await getLedgerEntries({ limit: 5 });

        const netCashFlow = monthlySummary.income - monthlySummary.expense;

        let html = `
            <div class="dashboard">
                <div class="welcome-section">
                    <h2>Good ${getTimeOfDay()},</h2>
                    <p class="text-muted">Here's your financial overview</p>
                </div>

                <div class="grid-4">
                    <div class="card summary-card">
                        <div class="summary-icon" style="background: var(--primary-light); color: var(--primary);">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Total Balance</span>
                            <span class="summary-value">${formatCurrency(totalBalance)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: #dcfce7; color: #22c55e;">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Income (This Month)</span>
                            <span class="summary-value">${formatCurrency(monthlySummary.income)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: #fee2e2; color: #ef4444;">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Expenses (This Month)</span>
                            <span class="summary-value">${formatCurrency(monthlySummary.expense)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: #dbeafe; color: #3b82f6;">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Net Cash Flow</span>
                            <span class="summary-value ${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(netCashFlow)}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="openAddTransaction()">
                        <i class="fas fa-plus"></i> Add Transaction
                    </button>
                    <button class="btn btn-secondary" onclick="navigateTo('accounts')">
                        <i class="fas fa-wallet"></i> Manage Accounts
                    </button>
                </div>

                <div class="grid-2">
                    <div class="card module-card" onclick="navigateTo('bid-save')">
                        <div class="module-card-header">
                            <i class="fas fa-handshake" style="color: var(--primary);"></i>
                            <span>Bid & Save</span>
                        </div>
                        <div class="module-card-body">
                            <div class="module-stat">
                                <span>Active Committees</span>
                                <strong>${activeCommittees}</strong>
                            </div>
                            <div class="module-stat">
                                <span>Total Gain</span>
                                <strong class="${committeeGain >= 0 ? 'text-success' : 'text-danger'}">
                                    ${formatCurrency(committeeGain)}
                                </strong>
                            </div>
                            <div class="module-stat">
                                <span>Current Contribution</span>
                                <strong>${formatCurrency(currentContribution)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="card module-card" onclick="navigateTo('loans')">
                        <div class="module-card-header">
                            <i class="fas fa-hand-holding-usd" style="color: var(--warning);"></i>
                            <span>Loans</span>
                        </div>
                        <div class="module-card-body">
                            <div class="module-stat">
                                <span>Active Loans</span>
                                <strong>${activeLoans.length}</strong>
                            </div>
                            ${activeLoans.length > 0 ? `
                                <div class="module-stat">
                                    <span>Next EMI</span>
                                    <strong>${formatCurrency(nextEMI === Infinity ? 0 : nextEMI)}</strong>
                                </div>
                                <div class="module-stat">
                                    <span>Total Remaining</span>
                                    <strong>${formatCurrency(activeLoans.reduce((s, l) => s + (l.remaining || 0), 0))}</strong>
                                </div>
                            ` : `
                                <div class="module-stat">
                                    <span class="text-muted">No active loans</span>
                                </div>
                            `}
                        </div>
                    </div>
                </div>

                <div class="grid-2">
                    <div class="card module-card" onclick="navigateTo('savings')">
                        <div class="module-card-header">
                            <i class="fas fa-piggy-bank" style="color: var(--success);"></i>
                            <span>Savings</span>
                        </div>
                        <div class="module-card-body">
                            <div class="module-stat">
                                <span>Active Goals</span>
                                <strong>${activeSavings.length}</strong>
                            </div>
                            <div class="module-stat">
                                <span>Total Saved</span>
                                <strong>${formatCurrency(totalSaved)}</strong>
                            </div>
                            ${activeSavings.length > 0 ? `
                                <div class="module-stat">
                                    <span>Avg Progress</span>
                                    <strong>${savingsProgress}%</strong>
                                </div>
                            ` : `
                                <div class="module-stat">
                                    <span class="text-muted">No savings goals</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="card">
                        <div class="module-card-header">
                            <i class="fas fa-clock" style="color: var(--text-muted);"></i>
                            <span>Recent Transactions</span>
                            <button class="btn btn-sm btn-secondary" onclick="navigateTo('transactions')">View All</button>
                        </div>
                        <div class="recent-transactions">
                            ${recentTxns.length > 0 ? recentTxns.map(txn => `
                                <div class="transaction-item">
                                    <div class="txn-info">
                                        <span class="txn-description">${txn.description || txn.type}</span>
                                        <span class="txn-date">${formatDate(txn.date)}</span>
                                    </div>
                                    <span class="txn-amount ${txn.direction === 'in' ? 'text-success' : 'text-danger'}">
                                        ${txn.direction === 'in' ? '+' : '-'} ${formatCurrency(txn.amount)}
                                    </span>
                                </div>
                            `).join('') : `
                                <div class="text-muted text-center" style="padding: 20px;">
                                    No transactions yet. Start by adding one!
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const style = document.createElement('style');
        style.textContent = `
            .dashboard .summary-card { display: flex; align-items: center; gap: 16px; }
            .summary-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
            .summary-info { flex: 1; }
            .summary-label { font-size: 0.8rem; color: var(--text-muted); }
            .summary-value { font-size: 1.4rem; font-weight: 700; }
            .quick-actions { display: flex; gap: 12px; margin: 16px 0 24px; flex-wrap: wrap; }
            .module-card { cursor: pointer; transition: all var(--transition); }
            .module-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
            .module-card-header { display: flex; align-items: center; gap: 10px; font-weight: 600; margin-bottom: 12px; }
            .module-card-header i { font-size: 1.2rem; }
            .module-stat { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9rem; }
            .module-stat span { color: var(--text-secondary); }
            .module-stat strong { font-weight: 600; }
            .recent-transactions { display: flex; flex-direction: column; gap: 8px; }
            .transaction-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
            .transaction-item:last-child { border-bottom: none; }
            .txn-info { display: flex; flex-direction: column; }
            .txn-description { font-weight: 500; }
            .txn-date { font-size: 0.75rem; color: var(--text-muted); }
            .txn-amount { font-weight: 600; }
            .welcome-section { margin-bottom: 20px; }
            .welcome-section h2 { font-size: 1.5rem; font-weight: 700; }
            .module-card-header .btn { margin-left: auto; }
        `;
        document.getElementById('page-style').textContent = style.textContent;

    } catch (error) {
        console.error('Dashboard error:', error);
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--danger);">
                <h3>⚠️ Error loading dashboard</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top:16px;">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
        `;
    }
}

// ----- Helper Functions -----

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
}

// ----- Open Add Transaction Modal -----

async function openAddTransaction() {
    const db = getDB();
    const accounts = await db.readAll('accounts');

    openModal('Add Transaction', `
        <form id="quickTransactionForm">
            <div class="form-group">
                <label>Type</label>
                <select class="form-control" id="quickTxnType" onchange="toggleQuickTxnFields()">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="form-control" id="quickTxnAmount" placeholder="₹ 0" required />
            </div>
            <div class="form-group" id="quickTxnAccountGroup">
                <label>Account</label>
                <select class="form-control" id="quickTxnAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group" id="quickTxnToAccountGroup" style="display:none;">
                <label>To Account</label>
                <select class="form-control" id="quickTxnToAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select class="form-control" id="quickTxnCategory"></select>
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="quickTxnDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" class="form-control" id="quickTxnDescription" placeholder="What's this for?" />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save Transaction</button>
        </form>
    `);

    const categories = await db.readAll('categories');
    const select = document.getElementById('quickTxnCategory');
    select.innerHTML = categories.map(c => 
        `<option value="${c.id}" data-type="${c.type}">${c.name}</option>`
    ).join('');

    document.getElementById('quickTransactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleQuickTransaction();
    });
}

async function handleQuickTransaction() {
    const type = document.getElementById('quickTxnType').value;
    const amount = parseFloat(document.getElementById('quickTxnAmount').value);
    const accountId = document.getElementById('quickTxnAccount').value;
    const toAccountId = document.getElementById('quickTxnToAccount').value;
    const categoryId = document.getElementById('quickTxnCategory').value;
    const date = document.getElementById('quickTxnDate').value;
    const description = document.getElementById('quickTxnDescription').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        if (type === 'transfer') {
            if (!toAccountId) {
                showToast('Please select a destination account', 'error');
                return;
            }
            await createTransferLedger(accountId, toAccountId, amount, date, description);
            showToast('Transfer completed successfully!', 'success');
        } else {
            const direction = type === 'income' ? 'in' : 'out';
            await createLedgerEntry({
                type: type,
                direction: direction,
                amount: amount,
                accountId: accountId,
                categoryId: categoryId,
                date: date,
                description: description || `${type} of ${formatCurrency(amount)}`,
                status: 'completed'
            });
            showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully!`, 'success');
        }

        closeModal();
        await loadDashboard();
    } catch (error) {
        console.error('Transaction failed:', error);
        showToast('Failed to save transaction: ' + error.message, 'error');
    }
}

function toggleQuickTxnFields() {
    const type = document.getElementById('quickTxnType')?.value;
    const accountGroup = document.getElementById('quickTxnAccountGroup');
    const toAccountGroup = document.getElementById('quickTxnToAccountGroup');
    const categorySelect = document.getElementById('quickTxnCategory');

    if (!accountGroup || !toAccountGroup || !categorySelect) return;

    if (type === 'transfer') {
        accountGroup.style.display = 'block';
        toAccountGroup.style.display = 'block';
        Array.from(categorySelect.options).forEach(opt => opt.style.display = 'block');
    } else {
        accountGroup.style.display = 'block';
        toAccountGroup.style.display = 'none';
        const isIncome = type === 'income';
        Array.from(categorySelect.options).forEach(opt => {
            const optType = opt.dataset.type;
            opt.style.display = (isIncome ? optType === 'income' : optType === 'expense') ? 'block' : 'none';
        });
    }
}

// Make functions globally accessible
window.loadDashboard = loadDashboard;
window.openAddTransaction = openAddTransaction;
window.toggleQuickTxnFields = toggleQuickTxnFields;