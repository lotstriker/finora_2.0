// ============================================
// FINORA — Dashboard (v2.0) — COMPLETE
// ============================================

async function loadDashboard() {
    const container = document.getElementById('pageContainer');
    const db = getDB();

    try {
        const totalBalance = await getTotalBalance();
        const monthlySummary = await getPeriodSummary(
            getMonthStart(new Date()),
            getMonthEnd(new Date())
        );

        let activeCommittees = 0;
        let currentContribution = 0;
        let totalGain = 0;
        let totalBidCost = 0;
        const currentMonth = getCurrentMonth();

        const committees = await db.readAll('committees');
        for (const c of committees) {
            if (c.status === 'active') {
                activeCommittees++;
                const cycles = await getCommitteeCycles(c.id);
                const completedCycles = cycles.filter(cy => cy.status === 'completed');
                
                for (const cy of completedCycles) {
                    totalGain += cy.cycleSaving || 0;
                    totalBidCost += cy.winningBid || 0;
                }
                
                const currentCycle = cycles.find(cy => 
                    getMonthYear(cy.month) === currentMonth && cy.status === 'pending'
                );
                if (currentCycle) {
                    currentContribution += currentCycle.totalPayable || 0;
                }
            }
        }
        const committeeNet = totalGain - totalBidCost;

        const loans = await db.readAll('loans');
        const activeLoans = loans.filter(l => l.status === 'active');
        let nextEMI = Infinity;
        let totalRemaining = 0;
        for (const l of activeLoans) {
            totalRemaining += l.remaining || 0;
            if (l.monthlyEMI < nextEMI) {
                nextEMI = l.monthlyEMI;
            }
        }
        if (nextEMI === Infinity) nextEMI = 0;

        const savingsGoals = await db.readAll('savings_goals');
        const activeSavings = savingsGoals.filter(g => g.status === 'active');
        let totalSaved = 0;
        let savingsProgress = 0;

        for (const goal of activeSavings) {
            const contributions = await getSavingsContributions(goal.id);
            const saved = contributions.reduce((s, c) => s + (c.amount || 0), 0);
            totalSaved += saved;
            if (goal.target > 0) {
                savingsProgress += (saved / goal.target) * 100;
            }
        }
        if (activeSavings.length > 0) {
            savingsProgress = Math.round(savingsProgress / activeSavings.length);
        }

        const recentTxns = await getLedgerEntries({ limit: 5 });

        const netCashFlow = monthlySummary.income - monthlySummary.expense;

        let html = `
            <div class="dashboard">
                <div class="welcome-section">
                    <h2>Good ${getTimeOfDay()},</h2>
                    <p class="text-muted">Here's your financial overview</p>
                </div>

                <div class="grid-4">
                    <div class="card summary-card">
                        <div class="summary-icon" style="background: var(--primary-accent); color: white;">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Total Balance</span>
                            <span class="summary-value">${formatCurrency(totalBalance)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: var(--success); color: white;">
                            <i class="fas fa-arrow-down"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Income (This Month)</span>
                            <span class="summary-value">${formatCurrency(monthlySummary.income)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: var(--danger); color: white;">
                            <i class="fas fa-arrow-up"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Expenses (This Month)</span>
                            <span class="summary-value">${formatCurrency(monthlySummary.expense)}</span>
                        </div>
                    </div>

                    <div class="card summary-card">
                        <div class="summary-icon" style="background: ${netCashFlow >= 0 ? 'var(--success)' : 'var(--danger)'}; color: white;">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="summary-info">
                            <span class="summary-label">Net Cash Flow</span>
                            <span class="summary-value ${netCashFlow >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(netCashFlow)}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div class="card module-card" onclick="navigateTo('bid-save')">
                        <div class="module-card-header">
                            <i class="fas fa-handshake" style="color: var(--primary-accent);"></i>
                            <span>Bid & Save</span>
                            <span class="module-badge">${activeCommittees} active</span>
                        </div>
                        <div class="module-card-body">
                            <div class="module-stat">
                                <span>Current Contribution</span>
                                <strong>${formatCurrency(currentContribution)}</strong>
                            </div>
                            <div class="module-stat">
                                <span>Net Result</span>
                                <strong class="${committeeNet >= 0 ? 'text-success' : 'text-danger'}">
                                    ${formatCurrency(committeeNet)}
                                </strong>
                            </div>
                        </div>
                    </div>

                    <div class="card module-card" onclick="navigateTo('loans')">
                        <div class="module-card-header">
                            <i class="fas fa-hand-holding-usd" style="color: var(--warning);"></i>
                            <span>Loans & EMI</span>
                            <span class="module-badge">${activeLoans.length} active</span>
                        </div>
                        <div class="module-card-body">
                            ${activeLoans.length > 0 ? `
                                <div class="module-stat">
                                    <span>Next EMI</span>
                                    <strong>${formatCurrency(nextEMI)}</strong>
                                </div>
                                <div class="module-stat">
                                    <span>Total Remaining</span>
                                    <strong>${formatCurrency(totalRemaining)}</strong>
                                </div>
                            ` : `
                                <div class="module-stat">
                                    <span class="text-muted">No active loans</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="card module-card" onclick="navigateTo('savings')">
                        <div class="module-card-header">
                            <i class="fas fa-piggy-bank" style="color: var(--success);"></i>
                            <span>Savings</span>
                            <span class="module-badge">${activeSavings.length} goals</span>
                        </div>
                        <div class="module-card-body">
                            <div class="module-stat">
                                <span>Total Saved</span>
                                <strong>${formatCurrency(totalSaved)}</strong>
                            </div>
                            ${activeSavings.length > 0 ? `
                                <div class="module-stat">
                                    <span>Avg Progress</span>
                                    <strong>${savingsProgress}%</strong>
                                </div>
                            ` : `
                                <div class="module-stat">
                                    <span class="text-muted">No savings goals</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="card">
                        <div class="module-card-header">
                            <i class="fas fa-clock" style="color: var(--text-muted);"></i>
                            <span>Recent Transactions</span>
                            <button class="btn btn-sm btn-ghost" onclick="navigateTo('transactions')">View All</button>
                        </div>
                        <div class="recent-transactions">
                            ${recentTxns.length > 0 ? recentTxns.map(txn => {
                                let displayAmount = txn.amount;
                                let displaySign = txn.direction === 'in' ? '+' : '-';
                                let displayDesc = txn.description || txn.type;
                                
                                if (txn.type === 'transfer') {
                                    displayDesc = 'Transfer';
                                    displaySign = '';
                                }
                                
                                return `
                                    <div class="transaction-item" onclick="viewTransaction('${txn.id}')">
                                        <div class="txn-info">
                                            <span class="txn-description">${displayDesc}</span>
                                            <span class="txn-date">${formatDate(txn.date)}</span>
                                        </div>
                                        <span class="txn-amount ${txn.direction === 'in' ? 'text-success' : 'text-danger'}">
                                            ${displaySign} ${formatCurrency(displayAmount)}
                                        </span>
                                    </div>
                                `;
                            }).join('') : `
                                <div class="text-muted text-center" style="padding: 20px;">
                                    No transactions yet.
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        const style = document.createElement('style');
        style.textContent = `
            .welcome-section { margin-bottom: 20px; }
            .welcome-section h2 { font-size: 1.4rem; font-weight: 700; }
            
            .summary-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; }
            .summary-icon { width: 44px; height: 44px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
            .summary-info { flex: 1; }
            .summary-label { font-size: 0.8rem; color: var(--text-muted); }
            .summary-value { font-size: 1.3rem; font-weight: 700; }
            
            .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
            
            .module-card { cursor: pointer; transition: all var(--transition); padding: 16px 20px; }
            .module-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
            
            .module-card-header { display: flex; align-items: center; gap: 10px; font-weight: 600; margin-bottom: 12px; }
            .module-card-header i { font-size: 1.1rem; }
            .module-card-header .module-badge { font-size: 0.65rem; font-weight: 500; color: var(--text-muted); background: var(--bg); padding: 1px 10px; border-radius: var(--radius-full); margin-left: auto; }
            .module-card-header .btn { margin-left: auto; }
            
            .module-stat { display: flex; justify-content: space-between; padding: 3px 0; font-size: 0.88rem; }
            .module-stat span { color: var(--text-secondary); }
            .module-stat strong { font-weight: 600; }
            
            .recent-transactions { display: flex; flex-direction: column; gap: 6px; }
            .transaction-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-light); cursor: pointer; }
            .transaction-item:last-child { border-bottom: none; }
            .txn-info { display: flex; flex-direction: column; }
            .txn-description { font-weight: 500; font-size: 0.88rem; }
            .txn-date { font-size: 0.7rem; color: var(--text-muted); }
            .txn-amount { font-weight: 600; font-size: 0.9rem; }
            
            @media (max-width: 768px) {
                .dashboard-grid { grid-template-columns: 1fr; }
            }
        `;
        document.getElementById('page-style').textContent = style.textContent;

    } catch (error) {
        console.error('Dashboard error:', error);
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--danger);">
                <h3>⚠️ Error loading dashboard</h3>
                <p style="color:var(--text-secondary);">${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top:16px;">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
        `;
    }
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
}

window.loadDashboard = loadDashboard;