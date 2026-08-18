// ============================================
// FINORA — Income (v2.0) — COMPLETE
// ============================================

async function loadIncome() {
    const container = document.getElementById('pageContainer');
    const db = getDB();

    const entries = await getLedgerEntries({ type: 'income' });
    const totalIncome = entries.reduce((s, e) => s + e.amount, 0);

    let html = `
        <div class="income-page">
            <div class="page-header">
                <h2><i class="fas fa-arrow-down"></i> Income</h2>
                <button class="btn btn-primary" onclick="openAddIncomeModal()">
                    <i class="fas fa-plus"></i> Add Income
                </button>
            </div>

            <div class="summary-card card">
                <span class="text-muted">Total Income</span>
                <h1>${formatCurrency(totalIncome)}</h1>
                <span class="text-muted">${entries.length} transactions</span>
            </div>

            <div class="income-list">
    `;

    if (entries.length > 0) {
        for (const e of entries) {
            const accountName = await getAccountName(e.accountId);
            const categoryName = e.categoryId ? await getCategoryName(e.categoryId) : '';
            html += `
                <div class="income-item" onclick="viewTransaction('${e.id}')">
                    <div class="income-item-left">
                        <div class="income-icon"><i class="fas fa-arrow-down"></i></div>
                        <div class="income-details">
                            <div class="income-desc">${e.description || e.type}</div>
                            <div class="income-meta">
                                <span>${formatDate(e.date)}</span>
                                <span>·</span>
                                <span>${accountName}</span>
                                ${categoryName ? `<span>·</span><span>${categoryName}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="income-amount text-success">+ ${formatCurrency(e.amount)}</div>
                </div>
            `;
        }
    } else {
        html += `
            <div class="empty-state">
                <i class="fas fa-arrow-down"></i>
                <p>No income recorded yet</p>
                <button class="btn btn-primary" onclick="openAddIncomeModal()">Add Income</button>
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
        .income-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 8px; cursor: pointer; transition: all var(--transition); }
        .income-item:hover { box-shadow: var(--shadow); transform: translateX(4px); }
        .income-item-left { display: flex; align-items: center; gap: 14px; flex: 1; }
        .income-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--success-bg); display: flex; align-items: center; justify-content: center; color: var(--success); flex-shrink: 0; }
        .income-details { flex: 1; }
        .income-desc { font-weight: 500; }
        .income-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; }
        .income-amount { font-weight: 600; font-size: 1rem; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function openAddIncomeModal() {
    const db = getDB();
    const accounts = await db.readAll('accounts');
    const categories = await db.readAll('categories');
    const incomeCats = categories.filter(c => c.type === 'income');

    if (accounts.length === 0) {
        showToast('Please create an account first!', 'warning');
        return;
    }

    openModal('Add Income', `
        <form id="incomeForm">
            <div class="form-group">
                <label>Amount *</label>
                <input type="number" class="form-control" id="incAmount" placeholder="₹ 0" required />
            </div>
            <div class="form-group">
                <label>Destination Account *</label>
                <select class="form-control" id="incAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Category *</label>
                <select class="form-control" id="incCategory">
                    ${incomeCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Income Source (Optional)</label>
                <input type="text" class="form-control" id="incSource" placeholder="ABC Company, Client XYZ, etc." />
            </div>
            <div class="form-group">
                <label>Date *</label>
                <input type="date" class="form-control" id="incDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" class="form-control" id="incDescription" placeholder="Salary, Freelance, etc." />
            </div>
            <div class="form-group">
                <label>Notes (Optional)</label>
                <textarea class="form-control" id="incNotes" rows="2" placeholder="Any additional notes"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Add Income</button>
        </form>
    `);

    document.getElementById('incomeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddIncome();
    });
}

async function handleAddIncome() {
    const amount = parseFloat(document.getElementById('incAmount').value);
    const accountId = document.getElementById('incAccount').value;
    const categoryId = document.getElementById('incCategory').value;
    const source = document.getElementById('incSource').value.trim();
    const date = document.getElementById('incDate').value;
    const description = document.getElementById('incDescription').value.trim();
    const notes = document.getElementById('incNotes').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        const fullDescription = description || (source ? `Income from ${source}` : 'Income');
        
        await createLedgerEntry({
            type: LEDGER_TYPES.INCOME,
            direction: LEDGER_DIRECTIONS.IN,
            amount: amount,
            accountId: accountId,
            categoryId: categoryId,
            date: date,
            description: fullDescription,
            notes: notes,
            module: 'income',
            status: LEDGER_STATUS.COMPLETED
        });

        closeModal();
        showToast('Income added successfully!', 'success');
        await loadIncome();
    } catch (error) {
        showToast('Failed to add income: ' + error.message, 'error');
    }
}

async function getAccountName(accountId) {
    try {
        const db = getDB();
        const acc = await db.read('accounts', accountId);
        return acc ? acc.name : 'Unknown';
    } catch (e) {
        return 'Unknown';
    }
}

async function getCategoryName(categoryId) {
    try {
        const db = getDB();
        const cat = await db.read('categories', categoryId);
        return cat ? cat.name : 'Uncategorized';
    } catch (e) {
        return 'Uncategorized';
    }
}

window.loadIncome = loadIncome;
window.openAddIncomeModal = openAddIncomeModal;
