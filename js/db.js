// ============================================
// FINORA — Database Schema (v2.0) — FIXED
// ============================================

const DB_NAME = 'FinoraDB';
const DB_VERSION = 3;  // ✅ Updated from 2 to 3

const STORES = [
    {
        name: 'ledger',
        keyPath: 'id',
        indexes: [
            { name: 'idx_date', keyPath: 'date' },
            { name: 'idx_type', keyPath: 'type' },
            { name: 'idx_account', keyPath: 'accountId' },
            { name: 'idx_toAccount', keyPath: 'toAccountId' },
            { name: 'idx_module', keyPath: 'module' },
            { name: 'idx_moduleRef', keyPath: 'moduleRef' },
            { name: 'idx_person', keyPath: 'personId' },
            { name: 'idx_category', keyPath: 'categoryId' },
            { name: 'idx_status', keyPath: 'status' },
            { name: 'idx_parent', keyPath: 'parentTransactionId' }
        ]
    },
    {
        name: 'accounts',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_type', keyPath: 'type' },
            { name: 'idx_status', keyPath: 'status' }  // ✅ ADDED
        ]
    },
    {
        name: 'people',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_status', keyPath: 'status' }  // ✅ ADDED
        ]
    },
    {
        name: 'loans',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_status', keyPath: 'status' },
            { name: 'idx_account', keyPath: 'accountId' }
        ]
    },
    {
        name: 'loan_installments',
        keyPath: 'id',
        indexes: [
            { name: 'idx_loanId', keyPath: 'loanId' },
            { name: 'idx_status', keyPath: 'status' },
            { name: 'idx_dueDate', keyPath: 'dueDate' },
            { name: 'idx_txnId', keyPath: 'transactionId' }
        ]
    },
    {
        name: 'committees',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_status', keyPath: 'status' }
        ]
    },
    {
        name: 'committee_memberships',
        keyPath: 'id',
        indexes: [
            { name: 'idx_committeeId', keyPath: 'committeeId' },
            { name: 'idx_userId', keyPath: 'userId' },
            { name: 'idx_slotNo', keyPath: 'slotNo' }
        ]
    },
    {
        name: 'committee_cycles',
        keyPath: 'id',
        indexes: [
            { name: 'idx_committeeId', keyPath: 'committeeId' },
            { name: 'idx_cycleNo', keyPath: 'cycleNo' },
            { name: 'idx_month', keyPath: 'month' },
            { name: 'idx_status', keyPath: 'status' },
            { name: 'idx_txnId', keyPath: 'transactionId' }
        ]
    },
    {
        name: 'savings_goals',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_status', keyPath: 'status' }
        ]
    },
    {
        name: 'savings_contributions',
        keyPath: 'id',
        indexes: [
            { name: 'idx_goalId', keyPath: 'goalId' },
            { name: 'idx_txnId', keyPath: 'transactionId' }
        ]
    },
    {
        name: 'recurring_rules',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_type', keyPath: 'type' },
            { name: 'idx_accountId', keyPath: 'accountId' },
            { name: 'idx_status', keyPath: 'status' },
            { name: 'idx_nextDue', keyPath: 'nextDue' }
        ]
    },
    {
        name: 'categories',
        keyPath: 'id',
        indexes: [
            { name: 'idx_name', keyPath: 'name' },
            { name: 'idx_type', keyPath: 'type' }
        ]
    },
    {
        name: 'settings',
        keyPath: 'key'
    }
];

let dbHelper = null;

async function initDB() {
    dbHelper = new IndexedDBHelper(DB_NAME, DB_VERSION, STORES);
    await dbHelper.open();
    await initDefaultCategories();
    await initDefaultSettings();
    return dbHelper;
}

function getDB() {
    if (!dbHelper) throw new Error('Database not initialized. Call initDB() first.');
    return dbHelper;
}

async function initDefaultCategories() {
    const db = getDB();
    const existing = await db.readAll('categories');
    if (existing.length > 0) return;

    const defaults = [
        // Expenses
        { id: 'cat-exp-food', name: 'Food', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-groceries', name: 'Groceries', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-transport', name: 'Transport', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-shopping', name: 'Shopping', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-bills', name: 'Bills & Utilities', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-entertainment', name: 'Entertainment', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-health', name: 'Health', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-education', name: 'Education', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-travel', name: 'Travel', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-rent', name: 'Rent', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-subscriptions', name: 'Subscriptions', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-insurance', name: 'Insurance', type: 'expense', isSystem: true, status: 'active' },
        { id: 'cat-exp-other', name: 'Other', type: 'expense', isSystem: true, status: 'active' },
        // Income
        { id: 'cat-inc-salary', name: 'Salary', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-freelance', name: 'Freelance', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-business', name: 'Business', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-investment', name: 'Investment', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-rent', name: 'Rent Income', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-gift', name: 'Gift', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-refund', name: 'Refund', type: 'income', isSystem: true, status: 'active' },
        { id: 'cat-inc-other', name: 'Other', type: 'income', isSystem: true, status: 'active' }
    ];
    await db.bulkCreate('categories', defaults);
}

async function initDefaultSettings() {
    const db = getDB();
    const settings = await db.readAll('settings');
    if (settings.length > 0) return;

    const defaults = [
        { key: 'theme', value: 'light' },
        { key: 'currency', value: '₹' },
        { key: 'defaultAccount', value: null }
    ];
    await db.bulkCreate('settings', defaults);
}

async function exportDatabase() {
    const db = getDB();
    return await db.exportAll();
}

async function importDatabase(data) {
    const db = getDB();
    await db.importAll(data);
}

async function clearAllData() {
    const db = getDB();
    for (const store of STORES) {
        if (store.name !== 'settings' && store.name !== 'categories') {
            await db.clearStore(store.name);
        }
    }
    return true;
}
