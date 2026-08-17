// ============================================
// FINORA — Transfers (v2.0) — FIXED
// ============================================

async function loadTransfers() {
    const container = document.getElementById('pageContainer');
    const db = getDB();

    const entries = await getLedgerEntries({ type: 'transfer' });

    // Group transfers by pair
    const transferPairs = [];
    const processed = new Set();

    for (const e of entries) {
        if (processed.has(e.id)) continue;
        if (e.toAccountId) {
            const pair = entries.find(x =>
                x.toAccountId === e.accountId &&
                x.accountId === e.toAccountId &&
                Math.abs(x.amount - e.amount) < 0.01 &&
                x.date === e.date
            );
            if (pair) {
                const fromName = await getAccountName(e.accountId);
                const toName = await getAccountName(e.toAccountId);
                transferPairs.push({
                    from: e.accountId,
                    to: e.toAccountId,
                    fromName: fromName,
                    toName: toName,
                    amount: e.amount,
                    date: e.date,
                    description: e.description || pair.description,
                    txnId: e.id,
                    pairTxnId: pair.id
                });
                processed.add(e.id);
                processed.add(pair.id);
            }
        }
    }

    const totalTransfers = transferPairs.reduce((s, t) => s + t.amount, 0);

    let html = `
        <div class="transfers-page">
            <div class="page-header">
                <h2>Transfers</h2>
                <button class="btn btn-primary" onclick="openAddTransferModal()">
                    <i class="fas fa-plus"></i> New Transfer
                </button>
            </div>

            <div class="summary-card card">
                <span class="text-muted">Total Transfers</span>
                <h1>${formatCurrency(totalTransfers)}</h1>
                <span class="text-muted">${transferPairs.length} transfers</span>
            </div>

            <div class="transfer-list">
    `;

    if (transferPairs.length > 0) {
        for (const t of transferPairs) {
            html += `
                <div class="transfer-item">
                    <div class="transfer-item-left">
                        <div class="transfer-icon"><i class="fas fa-exchange-alt"></i></div>
                        <div class="transfer-details">
                            <div class="transfer-desc">${t.description || 'Transfer'}</div>
                            <div class="transfer-meta">
                                <span>${formatDate(t.date)}</span>
                                <span>·</span>
                                <span>${t.fromName}</span>
                                <span><i class="fas fa-arrow-right"></i></span>
                                <span>${t.toName}</span>
                            </div>
                        </div>
                    </div>
                    <div class="transfer-amount">${formatCurrency(t.amount)}</div>
                </div>
            `;
        }
    } else {
        html += `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>No transfers yet</p>
                <button class="btn btn-primary" onclick="openAddTransferModal()">Add Transfer</button>
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
        .transfer-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 8px; transition: all var(--transition); }
        .transfer-item:hover { box-shadow: var(--shadow); }
        .transfer-item-left { display: flex; align-items: center; gap: 14px; flex: 1; }
        .transfer-icon { width: 40px; height: 40px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; color: #3b82f6; flex-shrink: 0; }
        .transfer-details { flex: 1; }
        .transfer-desc { font-weight: 500; }
        .transfer-meta { font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
        .transfer-amount { font-weight: 600; font-size: 1rem; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
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

async function openAddTransferModal() {
    const db = getDB();
    const accounts = await db.readAll('accounts');

    openModal('New Transfer', `
        <form id="transferForm">
            <div class="form-group">
                <label>From Account</label>
                <select class="form-control" id="transferFrom">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>To Account</label>
                <select class="form-control" id="transferTo">
                    ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="form-control" id="transferAmount" placeholder="₹ 0" required />
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="transferDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" class="form-control" id="transferDescription" placeholder="Why this transfer?" />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Complete Transfer</button>
        </form>
    `);

    document.getElementById('transferFrom').addEventListener('change', () => {
        const from = document.getElementById('transferFrom').value;
        const to = document.getElementById('transferTo');
        if (to.value === from) to.value = '';
    });

    document.getElementById('transferForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddTransfer();
    });
}

async function handleAddTransfer() {
    const fromAccountId = document.getElementById('transferFrom').value;
    const toAccountId = document.getElementById('transferTo').value;
    const amount = parseFloat(document.getElementById('transferAmount').value);
    const date = document.getElementById('transferDate').value;
    const description = document.getElementById('transferDescription').value;

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    if (fromAccountId === toAccountId) {
        showToast('Cannot transfer to the same account', 'error');
        return;
    }

    try {
        await createTransferLedger(fromAccountId, toAccountId, amount, date, description);
        closeModal();
        showToast('Transfer completed successfully!', 'success');
        await loadTransfers();
    } catch (error) {
        showToast('Failed to complete transfer: ' + error.message, 'error');
    }
}

// Make functions globally accessible
window.loadTransfers = loadTransfers;
window.openAddTransferModal = openAddTransferModal;