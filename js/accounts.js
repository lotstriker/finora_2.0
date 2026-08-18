// ============================================
// FINORA — Accounts (v2.0) — FIXED
// ============================================

const ACCOUNT_TYPES = ['Bank Account', 'Cash', 'Savings Account', 'Credit Card', 'Digital Wallet', 'Other'];

async function loadAccounts() {
    const container = document.getElementById('pageContainer');
    const db = getDB();
    const accounts = await db.readAll('accounts');

    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    const html = `
        <div class="accounts-page">
            <div class="page-header">
                <h2>Accounts</h2>
                <button class="btn btn-primary" onclick="openAddAccountModal()">
                    <i class="fas fa-plus"></i> Add Account
                </button>
            </div>

            <div class="total-balance-card card">
                <span class="text-muted">Total Balance</span>
                <h1>${formatCurrency(totalBalance)}</h1>
            </div>

            <div class="accounts-list">
                ${accounts.length > 0 ? accounts.map(acc => `
                    <div class="account-row" onclick="viewAccountDetails('${acc.id}')">
                        <div class="account-info">
                            <div class="account-icon"><i class="fas ${getAccountIcon(acc.type)}"></i></div>
                            <div>
                                <div class="account-name">${acc.name} ${acc.status === 'archived' ? '<span class="account-archived">Archived</span>' : ''}</div>
                                <div class="account-type">${acc.type}</div>
                            </div>
                        </div>
                        <div class="account-balance ${acc.balance >= 0 ? 'text-success' : 'text-danger'}">
                            ${formatCurrency(acc.balance || 0)}
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();viewAccountDetails('${acc.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();archiveAccount('${acc.id}')">
                                <i class="fas fa-archive"></i>
                            </button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="empty-state" style="grid-column:1/-1">
                        <i class="fas fa-wallet"></i>
                        <p>No accounts yet</p>
                        <button class="btn btn-primary" onclick="openAddAccountModal()">Add your first account</button>
                    </div>
                `}
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .total-balance-card { margin-bottom: 24px; text-align: center; padding: 24px; }
        .total-balance-card h1 { font-size: 2.5rem; font-weight: 700; margin-top: 4px; }
        .accounts-list { display: flex; flex-direction: column; gap: 8px; }
        .account-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer; transition: all var(--transition); }
        .account-row:hover { box-shadow: var(--shadow); transform: translateX(4px); }
        .account-info { display: flex; align-items: center; gap: 14px; flex: 1; }
        .account-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); display: flex; align-items: center; justify-content: center; font-size: 1rem; color: var(--primary); flex-shrink: 0; }
        .account-name { font-weight: 500; }
        .account-type { font-size: 0.75rem; color: var(--text-muted); }
        .account-archived { font-size: 0.65rem; background: var(--text-muted); color: white; padding: 1px 8px; border-radius: 10px; margin-left: 6px; }
        .account-balance { font-weight: 600; font-size: 1.1rem; padding: 0 12px; }
        .account-actions { display: flex; gap: 6px; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

function getAccountIcon(type) {
    const icons = {
        'Bank Account': 'fa-university',
        'Cash': 'fa-money-bill-wave',
        'Savings Account': 'fa-piggy-bank',
        'Credit Card': 'fa-credit-card',
        'Digital Wallet': 'fa-mobile-alt',
        'Other': 'fa-circle'
    };
    return icons[type] || 'fa-circle';
}

async function openAddAccountModal() {
    openModal('Add Account', `
        <form id="accountForm">
            <div class="form-group">
                <label>Account Name</label>
                <input type="text" class="form-control" id="accName" placeholder="HDFC, SBI, Cash, etc." required />
            </div>
            <div class="form-group">
                <label>Account Type</label>
                <select class="form-control" id="accType">
                    ${ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Initial Balance</label>
                <input type="number" class="form-control" id="accBalance" placeholder="0" value="0" />
                <small class="text-muted">This will create an opening balance ledger entry.</small>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create Account</button>
        </form>
    `);

    document.getElementById('accountForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddAccount();
    });
}

async function handleAddAccount() {
    const name = document.getElementById('accName').value.trim();
    const type = document.getElementById('accType').value;
    const balance = parseFloat(document.getElementById('accBalance').value) || 0;

    if (!name) {
        showToast('Please enter an account name', 'error');
        return;
    }

    try {
        const db = getDB();
        const account = {
            id: generateAccountId(),
            name: name,
            type: type,
            balance: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await db.create('accounts', account);

        // ✅ Create opening balance ledger entry
        if (balance > 0) {
            await createLedgerEntry({
                type: LEDGER_TYPES.OPENING_BALANCE,
                direction: LEDGER_DIRECTIONS.IN,
                amount: balance,
                accountId: account.id,
                date: new Date().toISOString(),
                description: 'Opening Balance',
                module: 'account',
                moduleRef: account.id,
                status: LEDGER_STATUS.COMPLETED
            });
        }

        closeModal();
        showToast('Account created successfully!', 'success');
        await loadAccounts();
    } catch (error) {
        showToast('Failed to create account: ' + error.message, 'error');
    }
}

// ✅ ARCHIVE instead of DELETE
async function archiveAccount(accountId) {
    const db = getDB();
    const account = await db.read('accounts', accountId);
    if (!account) {
        showToast('Account not found', 'error');
        return;
    }

    if (account.status === 'archived') {
        showToast('Account is already archived', 'info');
        return;
    }

    const transactions = await getLedgerEntries({ accountId });
    
    if (transactions.length > 0) {
        confirmAction(`Archive "${account.name}"? This account has ${transactions.length} transactions. They will remain in the ledger.`, async () => {
            try {
                account.status = 'archived';
                account.archivedAt = new Date().toISOString();
                account.updatedAt = new Date().toISOString();
                await db.update('accounts', account);
                showToast('Account archived successfully', 'warning');
                await loadAccounts();
            } catch (error) {
                showToast('Failed to archive: ' + error.message, 'error');
            }
        });
    } else {
        confirmAction(`Delete "${account.name}"? This account has no transactions.`, async () => {
            try {
                await db.delete('accounts', accountId);
                showToast('Account deleted', 'warning');
                await loadAccounts();
            } catch (error) {
                showToast('Failed to delete: ' + error.message, 'error');
            }
        });
    }
}

async function viewAccountDetails(accountId) {
    const db = getDB();
    const account = await db.read('accounts', accountId);
    if (!account) {
        showToast('Account not found', 'error');
        return;
    }

    const transactions = await getAccountTransactions(accountId);
    const totalIn = transactions.filter(t => t.displayDirection === 'in').reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter(t => t.displayDirection === 'out').reduce((s, t) => s + t.amount, 0);

    openModal(`Account: ${account.name}`, `
        <div class="account-detail">
            <div class="account-detail-balance">
                <span>Balance</span>
                <h2>${formatCurrency(account.balance || 0)}</h2>
            </div>
            <div class="account-detail-summary">
                <div><span>Type</span> ${account.type}</div>
                <div><span>Status</span> ${account.status || 'active'}</div>
                <div><span>Created</span> ${formatDate(account.createdAt)}</div>
                <div><span>Transactions</span> ${transactions.length}</div>
            </div>
            <div class="account-detail-stats">
                <div><span>Money In</span> <strong class="text-success">${formatCurrency(totalIn)}</strong></div>
                <div><span>Money Out</span> <strong class="text-danger">${formatCurrency(totalOut)}</strong></div>
            </div>
            <hr />
            <h4>Recent Transactions</h4>
            <div class="account-txns">
                ${transactions.slice(0, 10).map(t => {
                    const isIn = t.displayDirection === 'in';
                    return `
                        <div class="txn-item-small" onclick="viewTransaction('${t.id}')">
                            <span>${t.displayDescription || t.description || t.type}</span>
                            <span class="${isIn ? 'text-success' : 'text-danger'}">
                                ${isIn ? '+' : '-'} ${formatCurrency(t.amount)}
                            </span>
                        </div>
                    `;
                }).join('')}
                ${transactions.length === 0 ? '<span class="text-muted">No transactions</span>' : ''}
            </div>
        </div>
    `);
}

window.loadAccounts = loadAccounts;
window.openAddAccountModal = openAddAccountModal;
window.archiveAccount = archiveAccount;
