// ============================================
// FINORA — Expenses (v2.0) — COMPLETE
// ============================================

async function loadExpenses() {
    const container = document.getElementById('pageContainer');

    const entries = await getLedgerEntries({ type: 'expense' });
    const totalExpense = entries.reduce((s, e) => s + e.amount, 0);

    let html = `
        <div class="expenses-page">
            <div class="page-header">
                <h2><i class="fas fa-arrow-up"></i> Expenses</h2>
                <button class="btn btn-primary" onclick="openAddExpenseModal()">
                    <i class="fas fa-plus"></i> Add Expense
                </button>
            </div>

            <div class="summary-card card">
                <span class="text-muted">Total Expenses</span>
                <h1>${formatCurrency(totalExpense)}</h1>
                <span class="text-muted">${entries.length} transactions</span>
            </div>

            <div class="expense-list">
    `;

    if (entries.length > 0) {
        for (const e of entries) {
            const accountName = await getAccountName(e.accountId);
            const categoryName = e.categoryId ? await getCategoryName(e.categoryId) : '';
            html += `
                <div class="expense-item" onclick="viewTransaction('${e.id}')">
                    <div class="expense-item-left">
                        <div class="expense-icon"><i class="fas fa-arrow-up"></i></div>
                        <div class="expense-details">
                            <div class="expense-desc">${e.description || e.type}</div>
                            <div class="expense-meta">
                                <span>${formatDate(e.date)}</span>
                                <span>·</span>
                                <span>${accountName}</span>
                                ${categoryName ? `<span>·</span><span>${categoryName}</span>` : ''}
                                ${e.balanceWarning ? `<span class="txn-warning">⚠️ Insufficient Balance</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="expense-amount text-danger">- ${formatCurrency(e.amount)}</div>
                </div>
            `;
        }
    } else {
        html += `
            <div class="empty-state">
                <i class="fas fa-arrow-up"></i>
                <p>No expenses recorded yet</p>
                <button class="btn btn-primary" onclick="openAddExpenseModal()">Add Expense</button>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .summary-card { text-align: center; padding: 24px; margin-bottom: 24px; }
        .summary-card h1 { font-size: 2.5rem; font-weight: 700; }
        .expense-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 8px; cursor: pointer; transition: all var(--transition); }
        .expense-item:hover { box-shadow: var(--shadow); transform: translateX(4px); }
        .expense-item-left { display: flex; align-items: center; gap: 14px; flex: 1; }
        .expense-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--danger-bg); display: flex; align-items: center; justify-content: center; color: var(--danger); flex-shrink: 0; }
        .expense-details { flex: 1; }
        .expense-desc { font-weight: 500; }
        .expense-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; }
        .expense-amount { font-weight: 600; font-size: 1rem; }
        .txn-warning { color: var(--warning); font-weight: 600; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function openAddExpenseModal() {
    const db = getDB();
    const accounts = await db.readAll('accounts');
    const categories = await db.readAll('categories');
    const expenseCats = categories.filter(c => c.type === 'expense');

    if (accounts.length === 0) {
        showToast('Please create an account first!', 'warning');
        return;
    }

    openModal('Add Expense', `
        <form id="expenseForm">
            <div class="form-group">
                <label>Amount *</label>
                <input type="number" class="form-control" id="expAmount" placeholder="₹ 0" required />
            </div>
            <div class="form-group">
                <label>Account *</label>
                <select class="form-control" id="expAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Category *</label>
                <select class="form-control" id="expCategory">
                    ${expenseCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Payment Mode (Optional)</label>
                <select class="form-control" id="expPaymentMode">
                    <option value="">Select...</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Date *</label>
                <input type="date" class="form-control" id="expDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" class="form-control" id="expDescription" placeholder="What did you buy?" />
            </div>
            <div class="form-group">
                <label>Notes (Optional)</label>
                <textarea class="form-control" id="expNotes" rows="2" placeholder="Any additional notes"></textarea>
            </div>
            <div class="form-group">
                <label>Person (Optional)</label>
                <select class="form-control" id="expPerson">
                    <option value="">None</option>
                    ${(await db.readAll('people')).filter(p => p.status !== 'archived').map(p => 
                        `<option value="${p.id}">${p.name}</option>`
                    ).join('')}
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Add Expense</button>
        </form>
    `);

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddExpense();
    });
}

async function handleAddExpense() {
    const amount = parseFloat(document.getElementById('expAmount').value);
    const accountId = document.getElementById('expAccount').value;
    const categoryId = document.getElementById('expCategory').value;
    const date = document.getElementById('expDate').value;
    const description = document.getElementById('expDescription').value.trim();
    const notes = document.getElementById('expNotes').value.trim();
    const personId = document.getElementById('expPerson').value;
    const paymentMode = document.getElementById('expPaymentMode').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        const balance = await getAccountBalance(accountId);
        let balanceWarning = false;
        if (balance < amount) {
            if (!confirm(`⚠️ Insufficient balance! Recorded balance: ${formatCurrency(balance)}. Continue anyway?`)) {
                return;
            }
            balanceWarning = true;
        }

        const fullDescription = description || 'Expense';
        const notesWithMode = paymentMode ? `Mode: ${paymentMode}\n${notes}` : notes;

        await createLedgerEntry({
            type: LEDGER_TYPES.EXPENSE,
            direction: LEDGER_DIRECTIONS.OUT,
            amount: amount,
            accountId: accountId,
            categoryId: categoryId,
            personId: personId || null,
            date: date,
            description: fullDescription,
            notes: notesWithMode,
            module: 'expense',
            status: balanceWarning ? LEDGER_STATUS.INSUFFICIENT_BALANCE : LEDGER_STATUS.COMPLETED,
            balanceWarning: balanceWarning
        });

        closeModal();
        showToast('Expense added successfully!', 'success');
        await loadExpenses();
    } catch (error) {
        showToast('Failed to add expense: ' + error.message, 'error');
    }
}

window.loadExpenses = loadExpenses;
window.openAddExpenseModal = openAddExpenseModal;