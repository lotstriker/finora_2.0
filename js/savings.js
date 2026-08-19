// ============================================
// FINORA — Savings Goals (v2.0) — COMPLETE
// ============================================

async function loadSavings() {
    const container = document.getElementById('pageContainer');
    const db = getDB();
    const goals = await db.readAll('savings_goals');

    const goalData = [];
    for (const goal of goals) {
        const contributions = await getSavingsContributions(goal.id);
        const saved = contributions.reduce((s, c) => s + (c.amount || 0), 0);
        goalData.push({ ...goal, saved, contributions });
    }

    const totalSaved = goalData.reduce((s, g) => s + g.saved, 0);

    const html = `
        <div class="savings-page">
            <div class="page-header">
                <h2><i class="fas fa-piggy-bank"></i> Savings Goals</h2>
                <button class="btn btn-primary" onclick="openAddSavingsModal()">
                    <i class="fas fa-plus"></i> New Goal
                </button>
            </div>

            <div class="savings-summary card">
                <span class="text-muted">Total Saved</span>
                <h1>${formatCurrency(totalSaved)}</h1>
                <span class="text-muted">${goalData.length} goals</span>
            </div>

            <div class="savings-grid">
                ${goalData.length > 0 ? goalData.map(g => {
                    const progress = g.target > 0 ? (g.saved / g.target * 100) : 0;
                    return `
                        <div class="savings-card card" onclick="viewSavingsDetails('${g.id}')">
                            <div class="savings-header">
                                <h3>${g.name}</h3>
                                <span class="savings-status ${g.status}">${g.status}</span>
                            </div>
                            <div class="savings-amounts">
                                <div><span class="text-muted">Saved</span> <strong>${formatCurrency(g.saved)}</strong></div>
                                <div><span class="text-muted">Target</span> <strong>${formatCurrency(g.target)}</strong></div>
                            </div>
                            <div class="savings-progress">
                                <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                                <span>${Math.round(progress)}%</span>
                            </div>
                            ${g.targetDate ? `<div class="savings-date"><i class="fas fa-calendar"></i> Target: ${formatDate(g.targetDate)}</div>` : ''}
                            <div class="savings-actions">
                                <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();openAddSavingsContribution('${g.id}')">
                                    <i class="fas fa-plus"></i> Add Money
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openWithdrawSavings('${g.id}')">
                                    <i class="fas fa-arrow-down"></i> Withdraw
                                </button>
                            </div>
                        </div>
                    `;
                }).join('') : `
                    <div class="empty-state" style="grid-column:1/-1">
                        <i class="fas fa-piggy-bank"></i>
                        <p>No savings goals yet</p>
                        <button class="btn btn-primary" onclick="openAddSavingsModal()">Create a goal</button>
                    </div>
                `}
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .savings-summary { text-align: center; padding: 24px; margin-bottom: 24px; }
        .savings-summary h1 { font-size: 2.5rem; font-weight: 700; }
        .savings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .savings-card { padding: 20px 24px; cursor: pointer; transition: all var(--transition); }
        .savings-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
        .savings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .savings-header h3 { font-size: 1.05rem; font-weight: 600; }
        .savings-status { font-size: 0.7rem; padding: 2px 10px; border-radius: var(--radius-full); text-transform: uppercase; font-weight: 600; }
        .savings-status.active { background: var(--success-bg); color: var(--success); }
        .savings-status.completed { background: #dbeafe; color: #3b82f6; }
        .savings-amounts { display: flex; gap: 24px; margin: 8px 0; }
        .savings-amounts strong { font-size: 1.1rem; }
        .savings-progress { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
        .savings-date { font-size: 0.8rem; color: var(--text-muted); margin: 4px 0; }
        .savings-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function getSavingsContributions(goalId) {
    const db = getDB();
    return await db.getByIndex('savings_contributions', 'idx_goalId', goalId);
}

async function getActiveSavingsGoals() {
    const db = getDB();
    const goals = await db.readAll('savings_goals');
    return goals.filter(g => g.status === 'active');
}

async function openAddSavingsModal() {
    openModal('New Savings Goal', `
        <form id="savingsForm">
            <div class="form-group">
                <label>Goal Name</label>
                <input type="text" class="form-control" id="savingsName" placeholder="PS5, Vacation, etc." required />
            </div>
            <div class="form-group">
                <label>Target Amount</label>
                <input type="number" class="form-control" id="savingsTarget" placeholder="₹ 50,000" required />
            </div>
            <div class="form-group">
                <label>Target Date (Optional)</label>
                <input type="date" class="form-control" id="savingsTargetDate" />
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select class="form-control" id="savingsPriority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create Goal</button>
        </form>
    `);

    document.getElementById('savingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddSavingsGoal();
    });
}

async function handleAddSavingsGoal() {
    const name = document.getElementById('savingsName').value.trim();
    const target = parseFloat(document.getElementById('savingsTarget').value);
    const targetDate = document.getElementById('savingsTargetDate').value;
    const priority = document.getElementById('savingsPriority').value;

    if (!name || !target) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    try {
        const db = getDB();
        await db.create('savings_goals', {
            id: `GOAL-${Date.now()}`,
            name, target, targetDate: targetDate || null, priority,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        closeModal();
        showToast('Savings goal created!', 'success');
        await loadSavings();
    } catch (error) {
        showToast('Failed to create goal: ' + error.message, 'error');
    }
}

async function openAddSavingsContribution(goalId) {
    const db = getDB();
    const goal = await db.read('savings_goals', goalId);
    if (!goal) { showToast('Goal not found', 'error'); return; }

    const accounts = await db.readAll('accounts');

    openModal(`Add to ${goal.name}`, `
        <form id="savingsContributionForm">
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="form-control" id="savingsContributionAmount" placeholder="₹ 0" required />
            </div>
            <div class="form-group">
                <label>From Account</label>
                <select class="form-control" id="savingsContributionAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="savingsContributionDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Note (Optional)</label>
                <input type="text" class="form-control" id="savingsContributionNote" placeholder="Monthly savings" />
            </div>
            <button type="submit" class="btn btn-primary btn-block">Add Money</button>
        </form>
    `);

    document.getElementById('savingsContributionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddSavingsContribution(goalId);
    });
}

async function handleAddSavingsContribution(goalId) {
    const amount = parseFloat(document.getElementById('savingsContributionAmount').value);
    const accountId = document.getElementById('savingsContributionAccount').value;
    const date = document.getElementById('savingsContributionDate').value;
    const note = document.getElementById('savingsContributionNote').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        const balance = await getAccountBalance(accountId);
        if (balance < amount) {
            if (!confirm(`⚠️ Insufficient balance! Recorded balance: ${formatCurrency(balance)}. Continue anyway?`)) return;
        }

        const txn = await createLedgerEntry({
            type: LEDGER_TYPES.SAVINGS_CONTRIBUTION,
            direction: LEDGER_DIRECTIONS.OUT,
            amount: amount,
            accountId: accountId,
            date: date,
            description: `Savings: ${note || 'Contribution'}`,
            module: 'savings',
            moduleRef: goalId,
            status: balance < amount ? LEDGER_STATUS.INSUFFICIENT_BALANCE : LEDGER_STATUS.COMPLETED,
            balanceWarning: balance < amount
        });

        const db = getDB();
        await db.create('savings_contributions', {
            id: `SC-${Date.now()}`,
            goalId: goalId,
            amount: amount,
            accountId: accountId,
            date: date,
            note: note || null,
            transactionId: txn.id,
            type: 'contribution',
            createdAt: new Date().toISOString()
        });

        const goal = await db.read('savings_goals', goalId);
        if (goal) {
            const contributions = await getSavingsContributions(goalId);
            const saved = contributions.reduce((s, c) => s + c.amount, 0);
            if (saved >= goal.target) {
                goal.status = 'completed';
                goal.completedAt = new Date().toISOString();
                await db.update('savings_goals', goal);
            }
        }

        closeModal();
        showToast('Money added to savings!', 'success');
        await loadSavings();
    } catch (error) {
        showToast('Failed to add savings: ' + error.message, 'error');
    }
}

async function openWithdrawSavings(goalId) {
    const db = getDB();
    const goal = await db.read('savings_goals', goalId);
    if (!goal) { showToast('Goal not found', 'error'); return; }

    const contributions = await getSavingsContributions(goalId);
    const saved = contributions.reduce((s, c) => s + c.amount, 0);

    if (saved <= 0) {
        showToast('No money to withdraw', 'warning');
        return;
    }

    const accounts = await db.readAll('accounts');

    openModal(`Withdraw from ${goal.name}`, `
        <form id="savingsWithdrawForm">
            <div class="form-group">
                <label>Amount</label>
                <input type="number" class="form-control" id="savingsWithdrawAmount" placeholder="₹ 0" max="${saved}" required />
                <small class="text-muted">Available: ${formatCurrency(saved)}</small>
            </div>
            <div class="form-group">
                <label>To Account</label>
                <select class="form-control" id="savingsWithdrawAccount">
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" class="form-control" id="savingsWithdrawDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div class="form-group">
                <label>Note (Optional)</label>
                <input type="text" class="form-control" id="savingsWithdrawNote" placeholder="Withdrawal reason" />
            </div>
            <button type="submit" class="btn btn-warning btn-block">Withdraw Money</button>
        </form>
    `);

    document.getElementById('savingsWithdrawForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleWithdrawSavings(goalId);
    });
}

async function handleWithdrawSavings(goalId) {
    const amount = parseFloat(document.getElementById('savingsWithdrawAmount').value);
    const accountId = document.getElementById('savingsWithdrawAccount').value;
    const date = document.getElementById('savingsWithdrawDate').value;
    const note = document.getElementById('savingsWithdrawNote').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }

    try {
        const txn = await createLedgerEntry({
            type: LEDGER_TYPES.SAVINGS_WITHDRAWAL,
            direction: LEDGER_DIRECTIONS.IN,
            amount: amount,
            accountId: accountId,
            date: date,
            description: `Savings withdrawal: ${note || 'Withdrawal'}`,
            module: 'savings',
            moduleRef: goalId,
            status: LEDGER_STATUS.COMPLETED
        });

        const db = getDB();
        await db.create('savings_contributions', {
            id: `SC-${Date.now()}`,
            goalId: goalId,
            amount: -amount,
            accountId: accountId,
            date: date,
            note: note || null,
            transactionId: txn.id,
            type: 'withdrawal',
            createdAt: new Date().toISOString()
        });

        closeModal();
        showToast('Money withdrawn from savings!', 'success');
        await loadSavings();
    } catch (error) {
        showToast('Failed to withdraw: ' + error.message, 'error');
    }
}

async function viewSavingsDetails(goalId) {
    const db = getDB();
    const goal = await db.read('savings_goals', goalId);
    if (!goal) { showToast('Goal not found', 'error'); return; }

    const contributions = await getSavingsContributions(goalId);
    const saved = contributions.reduce((s, c) => s + c.amount, 0);
    const progress = goal.target > 0 ? (saved / goal.target * 100) : 0;

    let contributionsHtml = '';
    for (const c of contributions) {
        contributionsHtml += `
            <div class="contribution-item ${c.type === 'withdrawal' ? 'withdrawal' : ''}" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border-light);font-size:0.85rem;">
                <span>${formatDate(c.date)}</span>
                <span>${c.note || '—'}</span>
                <span class="${c.type === 'withdrawal' ? 'text-danger' : 'text-success'}">
                    ${c.type === 'withdrawal' ? '-' : '+'}${formatCurrency(Math.abs(c.amount))}
                </span>
                ${c.transactionId ? `<span class="txn-link" onclick="viewTransaction('${c.transactionId}')"><i class="fas fa-external-link-alt"></i></span>` : ''}
            </div>
        `;
    }

    openModal(`Savings: ${goal.name}`, `
        <div class="savings-detail">
            <div class="savings-detail-summary" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:0.9rem;">
                <div><span style="color:var(--text-muted);">Target</span> ${formatCurrency(goal.target)}</div>
                <div><span style="color:var(--text-muted);">Saved</span> <strong>${formatCurrency(saved)}</strong></div>
                <div><span style="color:var(--text-muted);">Remaining</span> <strong>${formatCurrency(goal.target - saved)}</strong></div>
                <div><span style="color:var(--text-muted);">Progress</span> ${Math.round(progress)}%</div>
                ${goal.targetDate ? `<div><span style="color:var(--text-muted);">Target Date</span> ${formatDate(goal.targetDate)}</div>` : ''}
                <div><span style="color:var(--text-muted);">Status</span> <span class="savings-status ${goal.status}">${goal.status}</span></div>
                <div><span style="color:var(--text-muted);">Priority</span> ${goal.priority || 'medium'}</div>
            </div>
            <hr style="margin:12px 0;" />
            <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:8px;">Contributions</h4>
            <div class="contribution-list">
                ${contributions.length > 0 ? contributionsHtml : '<span class="text-muted">No contributions yet</span>'}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="closeModal();openAddSavingsContribution('${goalId}')">
                    <i class="fas fa-plus"></i> Add Money
                </button>
                <button class="btn btn-warning" onclick="closeModal();openWithdrawSavings('${goalId}')">
                    <i class="fas fa-arrow-down"></i> Withdraw
                </button>
            </div>
        </div>
    `);
}

window.loadSavings = loadSavings;
window.getSavingsContributions = getSavingsContributions;
window.getActiveSavingsGoals = getActiveSavingsGoals;
window.openWithdrawSavings = openWithdrawSavings;