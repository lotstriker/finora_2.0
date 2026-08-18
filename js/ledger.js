// ============================================
// FINORA — Central Ledger (v2.0) — FIXED
// ============================================

const LEDGER_TYPES = {
    INCOME: 'income',
    EXPENSE: 'expense',
    TRANSFER: 'transfer',
    COMMITTEE_PAYMENT: 'committee_payment',
    COMMITTEE_PAYOUT: 'committee_payout',
    LOAN_EMI: 'loan_emi',
    SAVINGS_CONTRIBUTION: 'savings_contribution',
    SAVINGS_WITHDRAWAL: 'savings_withdrawal',
    OPENING_BALANCE: 'opening_balance',
    PERSON_LENDING: 'person_lending',
    PERSON_REPAYMENT: 'person_repayment'
};

const LEDGER_DIRECTIONS = {
    IN: 'in',
    OUT: 'out',
    TRANSFER: 'transfer'
};

const LEDGER_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REVERSED: 'reversed',
    INSUFFICIENT_BALANCE: 'warning'
};

// ----- CREATE LEDGER ENTRY -----
async function createLedgerEntry(data) {
    const db = getDB();
    
    const entry = {
        id: generateTxnId(),
        date: data.date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: data.type,
        direction: data.direction,
        status: data.status || LEDGER_STATUS.COMPLETED,
        amount: data.amount,
        accountId: data.accountId,
        toAccountId: data.toAccountId || null,
        categoryId: data.categoryId || null,
        module: data.module || null,
        moduleRef: data.moduleRef || null,
        personId: data.personId || null,
        description: data.description || '',
        notes: data.notes || '',
        tags: data.tags || [],
        parentTransactionId: data.parentTransactionId || null,
        balanceWarning: data.balanceWarning || false,
        metadata: data.metadata || {}
    };

    return await db.atomicTransaction(['ledger', 'accounts'], async (stores, tx) => {
        const ledgerStore = stores['ledger'];
        const accountStore = stores['accounts'];

        // 1. Save ledger entry
        const ledgerId = await new Promise((resolve, reject) => {
            const req = ledgerStore.add(entry);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // 2. Update account balance (skip for transfers - handled separately)
        if (entry.direction !== LEDGER_DIRECTIONS.TRANSFER) {
            const account = await new Promise((resolve, reject) => {
                const req = accountStore.get(entry.accountId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (account) {
                const balanceChange = entry.direction === LEDGER_DIRECTIONS.IN ? entry.amount : -entry.amount;
                account.balance = (account.balance || 0) + balanceChange;
                account.updatedAt = new Date().toISOString();
                await new Promise((resolve, reject) => {
                    const req = accountStore.put(account);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
            }
        }

        return { ...entry, id: ledgerId };
    });
}

// ----- CREATE TRANSFER — MASTER TRANSACTION (FIXED) -----
async function createTransferLedger(fromAccountId, toAccountId, amount, date, description) {
    const db = getDB();

    if (fromAccountId === toAccountId) {
        throw new Error('Source and destination accounts must be different.');
    }

    if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than zero.');
    }

    return await db.atomicTransaction(['ledger', 'accounts'], async (stores, tx) => {
        const ledgerStore = stores['ledger'];
        const accountStore = stores['accounts'];

        // ✅ SINGLE master transaction — ONE financial identity
        const masterTxn = {
            id: generateTxnId(),
            date: date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: LEDGER_TYPES.TRANSFER,
            direction: LEDGER_DIRECTIONS.TRANSFER,
            status: LEDGER_STATUS.COMPLETED,
            amount: amount,
            accountId: fromAccountId,
            toAccountId: toAccountId,
            categoryId: null,
            module: 'transfer',
            moduleRef: null,
            personId: null,
            parentTransactionId: null,
            description: description || `Transfer from ${fromAccountId} to ${toAccountId}`,
            notes: '',
            tags: [],
            balanceWarning: false,
            metadata: {}
        };

        // Save master transaction
        const txnId = await new Promise((resolve, reject) => {
            const req = ledgerStore.add(masterTxn);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Update both account balances
        const fromAccount = await new Promise((resolve, reject) => {
            const req = accountStore.get(fromAccountId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const toAccount = await new Promise((resolve, reject) => {
            const req = accountStore.get(toAccountId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (fromAccount) {
            fromAccount.balance = (fromAccount.balance || 0) - amount;
            fromAccount.updatedAt = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = accountStore.put(fromAccount);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        if (toAccount) {
            toAccount.balance = (toAccount.balance || 0) + amount;
            toAccount.updatedAt = new Date().toISOString();
            await new Promise((resolve, reject) => {
                const req = accountStore.put(toAccount);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        return { ...masterTxn, id: txnId };
    });
}

// ----- READ LEDGER -----
async function getLedgerEntries(filters = {}) {
    const db = getDB();
    let entries = await db.readAll('ledger');

    if (filters.accountId) {
        entries = entries.filter(e => 
            e.accountId === filters.accountId || 
            e.toAccountId === filters.accountId
        );
    }
    if (filters.type) entries = entries.filter(e => e.type === filters.type);
    if (filters.module) entries = entries.filter(e => e.module === filters.module);
    if (filters.moduleRef) entries = entries.filter(e => e.moduleRef === filters.moduleRef);
    if (filters.personId) entries = entries.filter(e => e.personId === filters.personId);
    if (filters.categoryId) entries = entries.filter(e => e.categoryId === filters.categoryId);
    if (filters.status) entries = entries.filter(e => e.status === filters.status);
    if (filters.dateFrom) entries = entries.filter(e => e.date >= filters.dateFrom);
    if (filters.dateTo) entries = entries.filter(e => e.date <= filters.dateTo);
    if (filters.limit) entries = entries.slice(0, filters.limit);
    
    if (filters.search) {
        const search = filters.search.toLowerCase();
        entries = entries.filter(e => 
            e.description.toLowerCase().includes(search) ||
            e.id.toLowerCase().includes(search) ||
            (e.tags && e.tags.some(t => t.toLowerCase().includes(search))) ||
            (e.notes && e.notes.toLowerCase().includes(search))
        );
    }

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    return entries;
}

// ----- GET ACCOUNT TRANSACTIONS WITH CONTEXT -----
async function getAccountTransactions(accountId, filters = {}) {
    const entries = await getLedgerEntries({ ...filters, accountId });
    
    return entries.map(e => {
        if (e.type === LEDGER_TYPES.TRANSFER) {
            const isSource = e.accountId === accountId;
            const isDestination = e.toAccountId === accountId;
            
            return {
                ...e,
                displayDirection: isSource ? 'out' : 'in',
                displayAmount: isSource ? -e.amount : e.amount,
                displayDescription: isSource 
                    ? `Transfer to ${e.toAccountId}`
                    : `Transfer from ${e.accountId}`,
                counterpartyAccountId: isSource ? e.toAccountId : e.accountId
            };
        }
        return e;
    });
}

async function getLedgerEntry(id) {
    const db = getDB();
    return await db.read('ledger', id);
}

async function getAccountBalance(accountId) {
    const db = getDB();
    const account = await db.read('accounts', accountId);
    return account ? account.balance || 0 : 0;
}

async function getTotalBalance() {
    const db = getDB();
    const accounts = await db.readAll('accounts');
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
}

async function getPeriodSummary(dateFrom, dateTo) {
    const entries = await getLedgerEntries({ dateFrom, dateTo });
    
    let income = 0, expense = 0, transfers = 0, savingsAllocation = 0;
    
    for (const e of entries) {
        if (e.type === LEDGER_TYPES.INCOME) income += e.amount;
        else if (e.type === LEDGER_TYPES.EXPENSE) expense += e.amount;
        else if (e.type === LEDGER_TYPES.TRANSFER) transfers += e.amount;
        else if (e.type === LEDGER_TYPES.SAVINGS_CONTRIBUTION) savingsAllocation += e.amount;
    }
    
    return { income, expense, transfers, savingsAllocation, net: income - expense };
}

async function getCategoryBreakdown(type, dateFrom, dateTo) {
    const entries = await getLedgerEntries({ type, dateFrom, dateTo });
    const db = getDB();
    const categories = await db.readAll('categories');
    const catMap = {};
    categories.forEach(c => catMap[c.id] = c.name);

    const breakdown = {};
    for (const e of entries) {
        const catId = e.categoryId || 'uncategorized';
        if (!breakdown[catId]) breakdown[catId] = { amount: 0, count: 0 };
        breakdown[catId].amount += e.amount;
        breakdown[catId].count += 1;
    }

    return Object.entries(breakdown).map(([id, data]) => ({
        id, name: catMap[id] || 'Uncategorized', amount: data.amount, count: data.count
    })).sort((a, b) => b.amount - a.amount);
}

async function getTopTransactions(type, dateFrom, dateTo, limit = 10) {
    const entries = await getLedgerEntries({ type, dateFrom, dateTo });
    entries.sort((a, b) => b.amount - a.amount);
    return entries.slice(0, limit);
}

async function reverseTransaction(txnId, reason = 'Correction') {
    const db = getDB();
    const original = await db.read('ledger', txnId);
    if (!original) throw new Error('Transaction not found');

    original.status = LEDGER_STATUS.REVERSED;
    original.updatedAt = new Date().toISOString();
    await db.update('ledger', original);

    const reversal = {
        type: original.type,
        direction: original.direction === LEDGER_DIRECTIONS.IN ? LEDGER_DIRECTIONS.OUT : LEDGER_DIRECTIONS.IN,
        amount: original.amount,
        accountId: original.accountId,
        toAccountId: original.toAccountId,
        date: new Date().toISOString(),
        description: `Reversal: ${original.description} (${reason})`,
        module: original.module,
        moduleRef: original.moduleRef,
        personId: original.personId,
        categoryId: original.categoryId,
        parentTransactionId: original.id,
        status: LEDGER_STATUS.COMPLETED
    };

    return await createLedgerEntry(reversal);
}
