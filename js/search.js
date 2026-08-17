// ============================================
// FINORA — Global Search (v2.0)
// ============================================

async function loadSearch() {
    const container = document.getElementById('pageContainer');

    const html = `
        <div class="search-page">
            <div class="page-header">
                <h2>🔍 Search</h2>
            </div>

            <div class="search-box card">
                <div class="search-input-group">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-control" id="searchInput" placeholder="Search transactions, people, committees, loans, savings..." />
                    <button class="btn btn-primary" onclick="performSearch()">Search</button>
                </div>
                <div class="search-filters" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" data-type="all" onclick="setSearchFilter('all')">All</button>
                    <button class="btn btn-sm btn-secondary" data-type="transactions" onclick="setSearchFilter('transactions')">Transactions</button>
                    <button class="btn btn-sm btn-secondary" data-type="people" onclick="setSearchFilter('people')">People</button>
                    <button class="btn btn-sm btn-secondary" data-type="committees" onclick="setSearchFilter('committees')">Committees</button>
                    <button class="btn btn-sm btn-secondary" data-type="loans" onclick="setSearchFilter('loans')">Loans</button>
                    <button class="btn btn-sm btn-secondary" data-type="savings" onclick="setSearchFilter('savings')">Savings</button>
                    <button class="btn btn-sm btn-secondary" data-type="recurring" onclick="setSearchFilter('recurring')">Recurring</button>
                </div>
            </div>

            <div id="searchResults" style="margin-top:20px;">
                <div class="text-center text-muted" style="padding:40px;">
                    <i class="fas fa-search" style="font-size:2rem;"></i>
                    <p>Enter a search term above</p>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .search-input-group { display: flex; gap: 12px; align-items: center; }
        .search-input-group i { font-size: 1.2rem; color: var(--text-muted); }
        .search-input-group .form-control { flex: 1; }
        .search-result-section { margin-bottom: 20px; }
        .search-result-section h4 { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; }
        .search-result-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border); margin-bottom: 6px; cursor: pointer; transition: all var(--transition); }
        .search-result-item:hover { box-shadow: var(--shadow); transform: translateX(4px); }
        .search-result-item .result-desc { font-weight: 500; }
        .search-result-item .result-meta { font-size: 0.75rem; color: var(--text-muted); }
        .search-result-item .result-tag { font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; background: var(--primary-light); color: var(--primary); }
    `;
    document.getElementById('page-style').textContent = style.textContent;

    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

let searchFilter = 'all';

function setSearchFilter(filter) {
    searchFilter = filter;
    document.querySelectorAll('.search-filters .btn').forEach(btn => {
        btn.classList.toggle('btn-primary', btn.dataset.type === filter);
        btn.classList.toggle('btn-secondary', btn.dataset.type !== filter);
    });
    performSearch();
}

async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const container = document.getElementById('searchResults');

    if (!query || query.length < 2) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding:40px;">
                <i class="fas fa-search" style="font-size:2rem;"></i>
                <p>Enter at least 2 characters to search</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="text-center text-muted" style="padding:40px;">Searching...</div>';

    try {
        const results = await performGlobalSearch(query);
        displaySearchResults(results, container);
    } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<div class="text-center text-danger" style="padding:40px;">Search failed: ${error.message}</div>`;
    }
}

async function performGlobalSearch(query) {
    const db = getDB();
    const lowerQuery = query.toLowerCase();
    const results = {
        transactions: [],
        people: [],
        committees: [],
        loans: [],
        savings: [],
        recurring: []
    };

    // Search Transactions
    const txns = await getLedgerEntries({ search: query });
    results.transactions = txns.slice(0, 20).map(t => ({
        id: t.id,
        description: t.description || t.type,
        meta: formatDate(t.date) + ' · ' + t.type,
        amount: t.amount,
        direction: t.direction,
        type: 'transaction',
        tag: 'Transaction'
    }));

    // Search People
    const people = await db.readAll('people');
    people.forEach(p => {
        if (p.name.toLowerCase().includes(lowerQuery) ||
            (p.phone && p.phone.includes(query)) ||
            (p.email && p.email.toLowerCase().includes(lowerQuery))) {
            results.people.push({
                id: p.id,
                description: p.name,
                meta: p.phone || p.email || 'Person',
                type: 'person',
                tag: 'Person'
            });
        }
    });

    // Search Committees
    const committees = await db.readAll('committees');
    committees.forEach(c => {
        if (c.name.toLowerCase().includes(lowerQuery)) {
            results.committees.push({
                id: c.id,
                description: c.name,
                meta: formatCurrency(c.totalAmount) + ' · ' + c.status,
                type: 'committee',
                tag: 'Committee'
            });
        }
    });

    // Search Loans
    const loans = await db.readAll('loans');
    loans.forEach(l => {
        if (l.name.toLowerCase().includes(lowerQuery)) {
            results.loans.push({
                id: l.id,
                description: l.name,
                meta: formatCurrency(l.totalAmount) + ' · ' + l.status,
                type: 'loan',
                tag: 'Loan'
            });
        }
    });

    // Search Savings Goals
    const goals = await db.readAll('savings_goals');
    goals.forEach(g => {
        if (g.name.toLowerCase().includes(lowerQuery)) {
            results.savings.push({
                id: g.id,
                description: g.name,
                meta: formatCurrency(g.target) + ' · ' + g.status,
                type: 'savings',
                tag: 'Savings'
            });
        }
    });

    // Search Recurring
    const recurring = await db.readAll('recurring_rules');
    recurring.forEach(r => {
        if (r.name.toLowerCase().includes(lowerQuery)) {
            results.recurring.push({
                id: r.id,
                description: r.name,
                meta: formatCurrency(r.amount) + ' · ' + (r.frequency || r.validityDays + ' days'),
                type: 'recurring',
                tag: 'Recurring'
            });
        }
    });

    return results;
}

function displaySearchResults(results, container) {
    const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    if (total === 0) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding:40px;">
                <i class="fas fa-search" style="font-size:2rem;"></i>
                <p>No results found</p>
            </div>
        `;
        return;
    }

    const sections = [
        { key: 'transactions', label: 'Transactions', results: results.transactions },
        { key: 'people', label: 'People', results: results.people },
        { key: 'committees', label: 'Committees', results: results.committees },
        { key: 'loans', label: 'Loans', results: results.loans },
        { key: 'savings', label: 'Savings Goals', results: results.savings },
        { key: 'recurring', label: 'Recurring Rules', results: results.recurring }
    ];

    let html = `<div class="search-summary">Found <strong>${total}</strong> results</div>`;

    for (const section of sections) {
        if (section.results.length === 0) continue;

        html += `
            <div class="search-result-section">
                <h4>${section.label} (${section.results.length})</h4>
                ${section.results.map(r => `
                    <div class="search-result-item" onclick="navigateToSearchResult('${r.type}', '${r.id}')">
                        <div>
                            <div class="result-desc">${r.description}</div>
                            <div class="result-meta">${r.meta}</div>
                        </div>
                        ${r.amount ? `
                            <span class="${r.direction === 'in' ? 'text-success' : 'text-danger'}">
                                ${r.direction === 'in' ? '+' : '-'} ${formatCurrency(r.amount)}
                            </span>
                        ` : ''}
                        <span class="result-tag">${r.tag}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

function navigateToSearchResult(type, id) {
    const map = {
        'transaction': () => { navigateTo('transactions'); setTimeout(() => viewTransaction(id), 300); },
        'person': () => { navigateTo('people'); setTimeout(() => viewPersonDetails(id), 300); },
        'committee': () => { navigateTo('bid-save'); setTimeout(() => viewCommitteeDetails(id), 300); },
        'loan': () => { navigateTo('loans'); setTimeout(() => viewLoanDetails(id), 300); },
        'savings': () => { navigateTo('savings'); setTimeout(() => viewSavingsDetails(id), 300); },
        'recurring': () => { navigateTo('recurring'); }
    };
    if (map[type]) map[type]();
}

window.loadSearch = loadSearch;
window.performSearch = performSearch;