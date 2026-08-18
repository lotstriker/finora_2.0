// ============================================
// FINORA — Main Application (v2.0) — FIXED
// ============================================

const App = { currentPage: 'dashboard', initialized: false };

const PAGE_HANDLERS = {
    'dashboard': loadDashboard,
    'transactions': loadTransactions,
    'accounts': loadAccounts,
    'income': loadIncome,
    'expenses': loadExpenses,
    'transfers': loadTransfers,
    'people': loadPeople,
    'loans': loadLoans,
    'bid-save': loadBidSave,
    'savings': loadSavings,
    'recurring': loadRecurring,
    'reports': loadReports,
    'search': loadSearch,
    'settings': loadSettings
};

async function initApp() {
    console.log('🚀 FINORA v2.0 Initializing...');
    try {
        const container = document.getElementById('pageContainer');
        if (container) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;"><h2>⏳ Loading FINORA...</h2><p class="text-muted">Please wait...</p></div>`;
        }

        await initDB();
        console.log('✅ Database initialized!');

        await loadAppSettings();
        console.log('✅ Settings loaded!');

        setupEventListeners();
        console.log('✅ Event listeners setup!');

        await navigateTo('dashboard');
        console.log('✅ Dashboard loaded!');

        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = formatDate(new Date());

        App.initialized = true;
        showToast('Welcome to FINORA v2.0! 🚀', 'success');
        console.log('🎉 FINORA v2.0 is ready!');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showToast('Failed to load FINORA. Please refresh.', 'error', 5000);
        const container = document.getElementById('pageContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px 20px;color:var(--danger);">
                    <h2>⚠️ Something went wrong</h2>
                    <p style="color:var(--text-secondary);">${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()" style="margin-top:16px;">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                </div>
            `;
        }
    }
}

async function loadAppSettings() {
    try {
        const db = getDB();
        const settings = await db.readAll('settings');
        settings.forEach(s => {
            if (s.key === 'theme') {
                document.documentElement.setAttribute('data-theme', s.value);
                App.theme = s.value;
            }
        });
        updateThemeIcon();
    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
        updateThemeIcon();
    }
}

function setupEventListeners() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    const hamburger = document.getElementById('hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !e.target.closest('.hamburger')) {
                sidebar.classList.remove('open');
            }
        }
    });

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            toggleTheme();
            try {
                const db = getDB();
                const theme = getTheme();
                db.update('settings', { key: 'theme', value: theme });
            } catch (e) {}
        });
    }

    const modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', closeModal);
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

async function navigateTo(page) {
    console.log(`📄 Navigating to: ${page}`);

    if (!PAGE_HANDLERS[page]) {
        showToast('Page not found', 'error');
        return;
    }

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    const titles = {
        'dashboard': 'Dashboard',
        'transactions': 'Transactions',
        'accounts': 'Accounts',
        'income': 'Income',
        'expenses': 'Expenses',
        'transfers': 'Transfers',
        'people': 'People',
        'loans': 'Loans',
        'bid-save': 'Bid & Save',
        'savings': 'Savings',
        'recurring': 'Recurring',
        'reports': 'Reports',
        'search': 'Search',
        'settings': 'Settings'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;

    App.currentPage = page;

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }

    try {
        await PAGE_HANDLERS[page]();
    } catch (error) {
        console.error(`❌ Error loading ${page}:`, error);
        const container = document.getElementById('pageContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:var(--danger);">
                    <h3>⚠️ Error loading page</h3>
                    <p style="color:var(--text-secondary);">${error.message}</p>
                    <button class="btn btn-primary" onclick="navigateTo('${page}')" style="margin-top:16px;">
                        <i class="fas fa-sync"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

function renderPage(html, afterRender = null) {
    const container = document.getElementById('pageContainer');
    if (!container) {
        console.error('❌ pageContainer not found!');
        return;
    }
    container.innerHTML = html;
    if (afterRender) afterRender();
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM Content Loaded');
    initApp();
});

window.navigateTo = navigateTo;
window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
