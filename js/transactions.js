// ============================================
// FINORA — Transactions (v2.0) — COMPLETE
// ============================================

async function loadTransactions() {
    const container = document.getElementById('pageContainer');

    const entries = await getLedgerEntries();
    const db = getDB();
    const accounts = await db.readAll('accounts');
    const categories = await db.readAll('categories');

    const accountMap = {};
    accounts.forEach(a => accountMap[a.id] = a.name);
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);

    const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

    const html = `
        <div class="transactions-page">
            <div class="page-header">
                <h2><i class="fas fa-list-ul"></i> All Transactions</h2>
            </div>

            <div class="txn-summary">
                <span>Total: <strong>${entries.length}</strong> transactions</span>
                <span>Income: <strong class="text-success">${formatCurrency(totalIncome)}</strong></span>
                <span>Expense: <strong class="text-danger">${formatCurrency(totalExpense)}</strong></span>
            </div>

            <div class="txn-list">
                ${entries.length > 0 ? entries.map(txn => {
                    let displayAmount = txn.amount;
                    let displaySign = '';
                    let displayDesc = txn.description || txn.type;
                    
                    if (txn.type === 'transfer') {
                        if (txn.accountId === txn.accountId) {
                            displaySign = '-';
                            displayDesc = `Transfer to ${accountMap[txn.toAccountId] || 'Unknown'}`;
                        } else if (txn.toAccountId === txn.accountId) {
                            displaySign = '+';
                            displayDesc = `Transfer from ${accountMap[txn.accountId] || 'Unknown'}`;
                        }
                    } else {
                        displaySign = txn.direction === 'in' ? '+' : '-';
                    }
                    
                    return `
                        <div class="txn-item" onclick="viewTransaction('${txn.id}')">
                            <div class="txn-item-left">
                                <div class="txn-icon ${txn.type}">
                                    <i class="fas ${getTxnIcon(txn.type)}"></i>
                                </div>
                                <div class="txn-details">
                                    <div class="txn-desc">${displayDesc}</div>
                                    <div class="txn-meta">
                                        <span>${formatDate(txn.date)}</span>
                                        <span>·</span>
                                        <span>${accountMap[txn.accountId] || 'Unknown'}</span>
                                        ${txn.categoryId ? `<span>·</span><span>${catMap[txn.categoryId] || ''}</span>` : ''}
                                        ${txn.module ? `<span>·</span><span class="txn-module">${txn.module}</span>` : ''}
                                        ${txn.status === 'warning' ? `<span class="txn-warning">⚠️ Insufficient Balance</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="txn-item-right">
                                <span class="txn-amount ${txn.direction === 'in' ? 'text-success' : 'text-danger'}">
                                    ${displaySign} ${formatCurrency(displayAmount)}
                                </span>
                                ${txn.toAccountId && txn.type !== 'transfer' ? `
                                    <span class="txn-transfer-detail">
                                        <i class="fas fa-arrow-right"></i>
                                        ${accountMap[txn.toAccountId] || 'Unknown'}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No transactions yet</p>
                        <p class="text-muted">Transactions are created when you add income, expenses, transfers, or other financial actions.</p>
                    </div>
                `}
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .page-header h2 { font-size: 1.5rem; font-weight: 700; }
        .txn-summary { display: flex; gap: 24px; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 16px; font-size: 0.9rem; flex-wrap: wrap; }
        .txn-summary strong { font-weight: 600; }
        .txn-list { display: flex; flex-direction: column; gap: 8px; }
        .txn-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer; transition: all var(--transition); }
        .txn-item:hover { box-shadow: var(--shadow); transform: translateX(4px); }
        .txn-item-left { display: flex; align-items: center; gap: 14px; flex: 1; }
        .txn-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .txn-icon.income { background: #22c55e; }
        .txn-icon.expense { background: #ef4444; }
        .txn-icon.transfer { background: #3b82f6; }
        .txn-icon.committee_payment { background: #8b5cf6; }
        .txn-icon.committee_payout { background: #8b5cf6; }
        .txn-icon.loan_emi { background: #f59e0b; }
        .txn-icon.savings_contribution { background: #06b6d4; }
        .txn-icon.opening_balance { background: #6366f1; }
        .txn-icon.external_funding { background: #6366f1; }
        .txn-icon.person_repayment { background: #6366f1; }
        .txn-details { flex: 1; }
        .txn-desc { font-weight: 500; }
        .txn-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; }
        .txn-module { background: var(--primary-light); color: var(--primary-accent); padding: 0 6px; border-radius: 4px; font-size: 0.7rem; }
        .txn-warning { color: var(--warning); font-weight: 600; }
        .txn-item-right { text-align: right; flex-shrink: 0; }
        .txn-amount { font-weight: 600; font-size: 1rem; }
        .txn-transfer-detail { font-size: 0.75rem; color: var(--text-muted); display: block; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

function getTxnIcon(type) {
    const icons = {
        'income': 'fa-arrow-down',
        'expense': 'fa-arrow-up',
        'transfer': 'fa-exchange-alt',
        'committee_payment': 'fa-handshake',
        'committee_payout': 'fa-hand-holding-usd',
        'loan_emi': 'fa-credit-card',
        'savings_contribution': 'fa-piggy-bank',
        'savings_withdrawal': 'fa-piggy-bank',
        'opening_balance': 'fa-plus-circle',
        'external_funding': 'fa-plus-circle',
        'person_repayment': 'fa-hand-holding-heart'
    };
    return icons[type] || 'fa-circle';
}

async function viewTransaction(txnId) {
    const txn = await getLedgerEntry(txnId);
    if (!txn) {
        showToast('Transaction not found', 'error');
        return;
    }

    const db = getDB();
    const account = await db.read('accounts', txn.accountId);
    const toAccount = txn.toAccountId ? await db.read('accounts', txn.toAccountId) : null;
    const category = txn.categoryId ? await db.read('categories', txn.categoryId) : null;
    const person = txn.personId ? await db.read('people', txn.personId) : null;

    let personHtml = person ? `<div class="txn-detail-row"><span>Person</span><span>${person.name}</span></div>` : '';

    openModal('Transaction Details', `
        <div class="txn-detail">
            <div class="txn-detail-header">
                <span class="txn-detail-id">${txn.id}</span>
                <span class="txn-detail-status ${txn.status}">${txn.status}</span>
                ${txn.balanceWarning ? '<span class="txn-warning">⚠️ Insufficient Balance Warning</span>' : ''}
            </div>
            <div class="txn-detail-row"><span>Amount</span><strong class="${txn.direction === 'in' ? 'text-success' : 'text-danger'}">${txn.direction === 'in' ? '+' : '-'} ${formatCurrency(txn.amount)}</strong></div>
            <div class="txn-detail-row"><span>Type</span><span>${txn.type}</span></div>
            <div class="txn-detail-row"><span>Account</span><span>${account ? account.name : 'Unknown'}</span></div>
            ${toAccount ? `<div class="txn-detail-row"><span>To Account</span><span>${toAccount.name}</span></div>` : ''}
            ${category ? `<div class="txn-detail-row"><span>Category</span><span>${category.name}</span></div>` : ''}
            ${personHtml}
            <div class="txn-detail-row"><span>Date</span><span>${formatDateTime(txn.date)}</span></div>
            <div class="txn-detail-row"><span>Description</span><span>${txn.description || '—'}</span></div>
            ${txn.notes ? `<div class="txn-detail-row"><span>Notes</span><span>${txn.notes}</span></div>` : ''}
            ${txn.module ? `<div class="txn-detail-row"><span>Module</span><span>${txn.module}</span></div>` : ''}
            ${txn.moduleRef ? `<div class="txn-detail-row"><span>Reference</span><span>${txn.moduleRef}</span></div>` : ''}
            <div class="txn-detail-actions">
                <button class="btn btn-danger" onclick="reverseTxn('${txn.id}')"><i class="fas fa-undo"></i> Reverse</button>
                <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            </div>
        </div>
    `);
}

async function reverseTxn(txnId) {
    if (confirm('Are you sure you want to reverse this transaction?')) {
        try {
            await reverseTransaction(txnId);
            showToast('Transaction reversed successfully', 'success');
            closeModal();
            await loadTransactions();
        } catch (error) {
            showToast('Failed to reverse: ' + error.message, 'error');
        }
    }
}

window.loadTransactions = loadTransactions;
window.viewTransaction = viewTransaction;
window.reverseTxn = reverseTxn;