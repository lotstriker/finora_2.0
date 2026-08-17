// ============================================
// FINORA — Settings (v2.0)
// ============================================

async function loadSettings() {
    const container = document.getElementById('pageContainer');
    const db = getDB();
    const settings = await db.readAll('settings');
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.key] = s.value);

    const theme = settingsMap.theme || 'light';
    const currency = settingsMap.currency || '₹';

    const html = `
        <div class="settings-page">
            <div class="page-header">
                <h2>Settings</h2>
            </div>

            <div class="settings-grid">
                <div class="card settings-card">
                    <h3><i class="fas fa-palette"></i> Appearance</h3>
                    <div class="settings-group">
                        <label>Theme</label>
                        <div class="settings-options">
                            <button class="btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="setThemeSetting('light')">
                                <i class="fas fa-sun"></i> Light
                            </button>
                            <button class="btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="setThemeSetting('dark')">
                                <i class="fas fa-moon"></i> Dark
                            </button>
                        </div>
                    </div>
                </div>

                <div class="card settings-card">
                    <h3><i class="fas fa-rupee-sign"></i> Currency</h3>
                    <div class="settings-group">
                        <label>Currency Symbol</label>
                        <div class="settings-options">
                            <button class="btn ${currency === '₹' ? 'btn-primary' : 'btn-secondary'}" onclick="setCurrencySetting('₹')">₹ INR</button>
                            <button class="btn ${currency === '$' ? 'btn-primary' : 'btn-secondary'}" onclick="setCurrencySetting('$')">$ USD</button>
                            <button class="btn ${currency === '€' ? 'btn-primary' : 'btn-secondary'}" onclick="setCurrencySetting('€')">€ EUR</button>
                            <button class="btn ${currency === '£' ? 'btn-primary' : 'btn-secondary'}" onclick="setCurrencySetting('£')">£ GBP</button>
                        </div>
                    </div>
                </div>

                <div class="card settings-card">
                    <h3><i class="fas fa-database"></i> Backup & Restore</h3>
                    <div class="settings-group">
                        <button class="btn btn-primary" onclick="exportBackup()">
                            <i class="fas fa-download"></i> Export Backup
                        </button>
                        <button class="btn btn-secondary" onclick="importBackup()">
                            <i class="fas fa-upload"></i> Restore Backup
                        </button>
                        <small class="text-muted">Encrypted JSON backup with password protection</small>
                    </div>
                </div>

                <div class="card settings-card">
                    <h3><i class="fas fa-file-export"></i> Data Export (CSV)</h3>
                    <div class="settings-group">
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('transactions')">
                            <i class="fas fa-file-csv"></i> Transactions
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('income')">
                            <i class="fas fa-file-csv"></i> Income
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('expenses')">
                            <i class="fas fa-file-csv"></i> Expenses
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('committee')">
                            <i class="fas fa-file-csv"></i> Committee History
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('loans')">
                            <i class="fas fa-file-csv"></i> Loan History
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="exportCSV('savings')">
                            <i class="fas fa-file-csv"></i> Savings History
                        </button>
                    </div>
                </div>

                <div class="card settings-card danger-zone">
                    <h3><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Danger Zone</h3>
                    <div class="settings-group">
                        <button class="btn btn-danger" onclick="clearAllData()">
                            <i class="fas fa-trash"></i> Clear All Data
                        </button>
                        <p class="text-muted" style="font-size:0.8rem;margin-top:8px;">
                            This will delete all your financial data. Export backup first!
                        </p>
                    </div>
                </div>

                <div class="card settings-card">
                    <h3><i class="fas fa-info-circle"></i> About</h3>
                    <div class="settings-group">
                        <p><strong>FINORA</strong> v2.0</p>
                        <p class="text-muted" style="font-size:0.85rem;">Personal Financial Management</p>
                        <p class="text-muted" style="font-size:0.8rem;">One Ledger. One Source of Truth.</p>
                        <p class="text-muted" style="font-size:0.75rem;">Built with ❤️</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .settings-card { padding: 20px 24px; }
        .settings-card h3 { font-size: 1rem; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
        .settings-group { display: flex; flex-direction: column; gap: 10px; }
        .settings-group label { font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); }
        .settings-options { display: flex; gap: 8px; flex-wrap: wrap; }
        .settings-options .btn { flex: 1; min-width: 60px; justify-content: center; }
        .danger-zone { border-color: var(--danger); border-width: 2px; }
        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function setThemeSetting(theme) {
    setTheme(theme);
    const db = getDB();
    await db.update('settings', { key: 'theme', value: theme });
    updateThemeIcon();
    showToast(`Theme set to ${theme}`, 'success');
    await loadSettings();
}

async function setCurrencySetting(currency) {
    setCurrency(currency);
    const db = getDB();
    await db.update('settings', { key: 'currency', value: currency });
    showToast(`Currency set to ${currency}`, 'success');
    await loadSettings();
}

async function clearAllData() {
    confirmAction('⚠️ This will delete ALL your financial data. Are you sure?', async () => {
        confirmAction('🔄 Final confirmation: Clear all data?', async () => {
            try {
                await clearAllData();
                showToast('All data cleared', 'warning');
                await loadSettings();
            } catch (error) {
                showToast('Failed to clear data: ' + error.message, 'error');
            }
        });
    });
}

window.loadSettings = loadSettings;
window.setThemeSetting = setThemeSetting;
window.setCurrencySetting = setCurrencySetting;