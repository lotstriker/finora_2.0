// ============================================
// FINORA — Accounts (v2.0) — COMPLETE FIXED
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
                <h2><i class="fas fa-wallet"></i> Accounts</h2>
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
                    <div class="empty-state">
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
        .account-icon { width: 40px; height: 40px; border-radius: 50%; background: var(--primary-light); display: flex; align-items: center; justify-content: center; font-size: 1rem; color: var(--primary-accent); flex-shrink: 0; }
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

// ============================================
// ✅ ADD MONEY — toggleAddMoneyFields DEFINED FIRST
// ============================================

// ✅ DEFINE toggleAddMoneyFields GLOBALLY FIRST
window.toggleAddMoneyFields = function() {
    console.log('toggleAddMoneyFields called');
    const sourceEl = document.getElementById('addMoneySource');
    if (!sourceEl) {
        console.log('addMoneySource not found');
        return;
    }
    const source = sourceEl.value;
    
    // Hide all source fields
    document.querySelectorAll('.source-fields').forEach(el => el.style.display = 'none');
    
    // Show the selected source field
    const fieldMap = {
        'income': 'incomeFields',
        'transfer': 'transferFields',
        'person_repayment': 'personRepaymentFields',
        'external_funding': 'externalFundingFields',
        'opening_balance': 'openingBalanceFields'
    };
    
    const target = document.getElementById(fieldMap[source]);
    if (target) {
        target.style.display = 'block';
        console.log('Showing:', fieldMap[source]);
    }
};

// ✅ OPEN ADD MONEY MODAL
async function openAddMoneyModal(accountId) {
    const db = getDB();
    const account = await db.read('accounts', accountId);
    if (!account) {
        showToast('Account not found', 'error');
        return;
    }

    const accounts = await db.readAll('accounts');
    const people = await db.readAll('people');
    const categories = await db.readAll('categories');

    openModal(`Add Money — ${account.name}`, `
        <form id="addMoneyForm">
            <div class="form-group">
                <label>Amount *</label>
                <input type="number" class="form-control" id="addMoneyAmount" placeholder="₹ 0" required />
            </div>
            
            <div class="form-group">
                <label>Where did this money come from? *</label>
                <select class="form-control" id="addMoneySource" onchange="window.toggleAddMoneyFields()">
                    <option value="income">Income</option>
                    <option value="transfer">Another Account (Transfer)</option>
                    <option value="person_repayment">Person Repayment</option>
                    <option value="external_funding">External Funding</option>
                    <option value="opening_balance">Opening Balance</option>
                </select>
            </div>

            <div id="incomeFields" class="source-fields">
                <div class="form-group">
                    <label>Category *</label>
                    <select class="form-control" id="addMoneyCategory">
                        ${categories.filter(c => c.type === 'income').map(c => 
                            `<option value="${c.id}">${c.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Income Source (Optional)</label>
                    <input type="text" class="form-control" id="addMoneySourceName" placeholder="ABC Company, Client XYZ" />
                </div>
            </div>

            <div id="transferFields" class="source-fields" style="display:none;">
                <div class="form-group">
                    <label>From Account *</label>
                    <select class="form-control" id="addMoneyFromAccount">
                        ${accounts.filter(a => a.id !== accountId && a.status !== 'archived').map(a => 
                            `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`
                        ).join('')}
                    </select>
                </div>
            </div>

            <div id="personRepaymentFields" class="source-fields" style="display:none;">
                <div class="form-group">
                    <label>Person *</label>
                    <select class="form-control" id="addMoneyPerson">
                        ${people.filter(p => p.status !== 'archived').map(p => 
                            `<option value="${p.id}">${p.name}</option>`
                        ).join('')}
                        <option value="new">Add New Person</option>
                    </select>
                </div>
            </div>

            <div id="externalFundingFields" class="source-fields" style="display:none;">
                <div class="form-group">
                    <label>Source Description</label>
                    <input type="text" class="form-control" id="addMoneyExternalSource" placeholder="Cash, Gift, etc." />
                </div>
            </div>

            <div id="openingBalanceFields" class="source-fields" style="display:none;">
                <div class="form-group">
                    <label>Note (Optional)</label>
                    <input type="text" class="form-control" id="addMoneyOpeningNote" placeholder="Existing balance from before Finora" />
                </div>
            </div>

            <div class="form-group">
                <label>Date *</label>
                <input type="date" class="form-control" id="addMoneyDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Notes (Optional)</label>
                <textarea class="form-control" id="addMoneyNotes" rows="2" placeholder="Any additional notes"></textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-block">Add Money</button>
        </form>
    `);

    // ✅ Call toggleAddMoneyFields after modal is rendered
    setTimeout(() => {
        window.toggleAddMoneyFields();
    }, 100);

    // Handle new person
    const personSelect = document.getElementById('addMoneyPerson');
    if (personSelect) {
        personSelect.addEventListener('change', function() {
            if (this.value === 'new') {
                const name = prompt('Enter person name:');
                if (name && name.trim()) {
                    showToast('Person added. Please select them from the list.', 'info');
                }
                this.value = '';
            }
        });
    }

    document.getElementById('addMoneyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddMoney(accountId);
    });
}

// ✅ HANDLE ADD MONEY
async function handleAddMoney(accountId) {
    const amount = parseFloat(document.getElementById('addMoneyAmount').value);
    const source = document.getElementById('addMoneySource').value;
    const date = document.getElementById('addMoneyDate').value;
    const notes = document.getElementById('addMoneyNotes').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        let result;

        switch(source) {
            case 'income': {
                const categoryId = document.getElementById('addMoneyCategory').value;
                const sourceName = document.getElementById('addMoneySourceName').value.trim();
                const description = sourceName ? `Income from ${sourceName}` : 'Income';
                result = await createLedgerEntry({
                    type: LEDGER_TYPES.INCOME,
                    direction: LEDGER_DIRECTIONS.IN,
                    amount: amount,
                    accountId: accountId,
                    categoryId: categoryId,
                    date: date,
                    description: description,
                    notes: notes,
                    module: 'income',
                    status: LEDGER_STATUS.COMPLETED
                });
                break;
            }

            case 'transfer': {
                const fromAccountId = document.getElementById('addMoneyFromAccount').value;
                if (!fromAccountId) {
                    showToast('Please select a source account', 'error');
                    return;
                }
                if (fromAccountId === accountId) {
                    showToast('Cannot transfer to the same account', 'error');
                    return;
                }
                result = await createTransferLedger(fromAccountId, accountId, amount, date, notes || 'Transfer');
                break;
            }

            case 'person_repayment': {
                const personId = document.getElementById('addMoneyPerson').value;
                if (!personId || personId === 'new') {
                    showToast('Please select a person', 'error');
                    return;
                }
                result = await createLedgerEntry({
                    type: LEDGER_TYPES.PERSON_REPAYMENT,
                    direction: LEDGER_DIRECTIONS.IN,
                    amount: amount,
                    accountId: accountId,
                    personId: personId,
                    date: date,
                    description: `Repayment from ${personId}`,
                    notes: notes,
                    module: 'people',
                    status: LEDGER_STATUS.COMPLETED
                });
                break;
            }

            case 'external_funding': {
                const sourceName = document.getElementById('addMoneyExternalSource').value.trim();
                const description = sourceName ? `External Funding: ${sourceName}` : 'External Funding';
                result = await createLedgerEntry({
                    type: LEDGER_TYPES.EXTERNAL_FUNDING,
                    direction: LEDGER_DIRECTIONS.IN,
                    amount: amount,
                    accountId: accountId,
                    date: date,
                    description: description,
                    notes: notes,
                    module: 'account',
                    status: LEDGER_STATUS.COMPLETED
                });
                break;
            }

            case 'opening_balance': {
                const note = document.getElementById('addMoneyOpeningNote').value.trim();
                const description = note || 'Opening Balance';
                result = await createLedgerEntry({
                    type: LEDGER_TYPES.OPENING_BALANCE,
                    direction: LEDGER_DIRECTIONS.IN,
                    amount: amount,
                    accountId: accountId,
                    date: date,
                    description: description,
                    notes: notes,
                    module: 'account',
                    status: LEDGER_STATUS.COMPLETED
                });
                break;
            }

            default:
                showToast('Unknown source type', 'error');
                return;
        }

        closeModal();
        showToast(`₹${formatCurrency(amount)} added successfully!`, 'success');
        await loadAccounts();
        
        if (window._currentAccountId === accountId) {
            await viewAccountDetails(accountId);
        }
        
    } catch (error) {
        showToast('Failed to add money: ' + error.message, 'error');
    }
}

// ✅ VIEW ACCOUNT DETAILS
async function viewAccountDetails(accountId) {
    const db = getDB();
    const account = await db.read('accounts', accountId);
    if (!account) {
        showToast('Account not found', 'error');
        return;
    }

    window._currentAccountId = accountId;

    const transactions = await getAccountTransactions(accountId);
    const totalIn = transactions.filter(t => t.displayDirection === 'in').reduce((s, t) => s + t.amount, 0);
    const totalOut = transactions.filter(t => t.displayDirection === 'out').reduce((s, t) => s + t.amount, 0);

    openModal(`Account: ${account.name}`, `
        <div class="account-detail">
            <div class="account-detail-balance">
                <span>Balance</span>
                <h2>${formatCurrency(account.balance || 0)}</h2>
            </div>
            
            <div class="account-quick-actions">
                <button class="btn btn-primary" onclick="closeModal();openAddMoneyModal('${accountId}')">
                    <i class="fas fa-plus"></i> Add Money
                </button>
                <button class="btn btn-secondary" onclick="closeModal();openAddTransferModal()">
                    <i class="fas fa-exchange-alt"></i> Transfer
                </button>
                <button class="btn btn-secondary" onclick="closeModal();openAddExpenseModal()">
                    <i class="fas fa-arrow-up"></i> Expense
                </button>
                <button class="btn btn-secondary" onclick="closeModal();openAddIncomeModal()">
                    <i class="fas fa-arrow-down"></i> Income
                </button>
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
                            ${t.type === 'transfer' ? `<span class="txn-tag">Transfer</span>` : ''}
                        </div>
                    `;
                }).join('')}
                ${transactions.length === 0 ? '<span class="text-muted">No transactions</span>' : ''}
            </div>
        </div>
    `);
}

// ✅ EXPOSE ALL FUNCTIONS GLOBALLY
window.loadAccounts = loadAccounts;
window.openAddAccountModal = openAddAccountModal;
window.archiveAccount = archiveAccount;
window.openAddMoneyModal = openAddMoneyModal;
window.handleAddMoney = handleAddMoney;
window.viewAccountDetails = viewAccountDetails;

console.log('✅ accounts.js loaded — toggleAddMoneyFields is defined:', typeof window.toggleAddMoneyFields);