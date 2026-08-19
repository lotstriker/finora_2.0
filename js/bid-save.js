// ============================================
// FINORA — Bid & Save (v2.0) — COMPLETE
// ============================================

async function loadBidSave() {
    const container = document.getElementById('pageContainer');
    const db = getDB();
    const committees = await db.readAll('committees');

    let activeCount = 0;
    let currentContribution = 0;
    let totalGain = 0;
    let totalBidCost = 0;
    const currentMonth = getCurrentMonth();

    for (const c of committees) {
        if (c.status === 'active') {
            activeCount++;
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
    const netResult = totalGain - totalBidCost;

    let committeeCardsHtml = '';
    
    if (committees.length > 0) {
        for (const c of committees) {
            const cycles = await getCommitteeCycles(c.id);
            const completed = cycles.filter(cy => cy.status === 'completed');
            const progress = c.duration > 0 ? (completed.length / c.duration * 100) : 0;
            const totalSaving = completed.reduce((sum, cy) => sum + (cy.cycleSaving || 0), 0);
            const totalBid = completed.reduce((sum, cy) => sum + (cy.winningBid || 0), 0);
            const net = totalSaving - totalBid;

            committeeCardsHtml += `
                <div class="committee-card card" onclick="viewCommitteeDetails('${c.id}')">
                    <div class="committee-header">
                        <div class="committee-info">
                            <h3>${c.name}</h3>
                            <span class="committee-status ${c.status}">${c.status}</span>
                        </div>
                        <div class="committee-amounts">
                            <div><span class="text-muted">Amount</span> ${formatCurrency(c.totalAmount)}</div>
                            <div><span class="text-muted">Members</span> ${c.members}</div>
                        </div>
                    </div>
                    <div class="committee-progress">
                        <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                        <span>${Math.round(progress)}%</span>
                    </div>
                    <div class="committee-details">
                        <div><span>Base Contribution</span> ${formatCurrency(c.baseContribution)}</div>
                        <div><span>Total Saving</span> <strong class="text-success">${formatCurrency(totalSaving)}</strong></div>
                        <div><span>Net Result</span> <strong class="${net >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(net)}</strong></div>
                        <div><span>Next Cycle</span> ${c.nextCycle ? formatMonth(c.nextCycle) : '—'}</div>
                    </div>
                </div>
            `;
        }
    } else {
        committeeCardsHtml = `
            <div class="empty-state">
                <i class="fas fa-handshake"></i>
                <p>No committees yet</p>
                <button class="btn btn-primary" onclick="openAddCommitteeModal()">Start a Committee</button>
            </div>
        `;
    }

    const html = `
        <div class="bid-save-page">
            <div class="page-header">
                <h2><i class="fas fa-handshake"></i> Bid & Save</h2>
                <button class="btn btn-primary" onclick="openAddCommitteeModal()">
                    <i class="fas fa-plus"></i> New Committee
                </button>
            </div>

            <div class="bid-save-summary">
                <div class="summary-stat card">
                    <span class="label">Active Committees</span>
                    <span class="value">${activeCount}</span>
                </div>
                <div class="summary-stat card">
                    <span class="label">Current Contribution</span>
                    <span class="value">${formatCurrency(currentContribution)}</span>
                </div>
                <div class="summary-stat card">
                    <span class="label">Net Result</span>
                    <span class="value ${netResult >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netResult)}</span>
                </div>
            </div>

            <div class="committee-list">
                ${committeeCardsHtml}
            </div>
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .bid-save-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-stat { text-align: center; padding: 16px; }
        .summary-stat .label { font-size: 0.8rem; color: var(--text-muted); }
        .summary-stat .value { font-size: 1.4rem; font-weight: 700; }
        
        .committee-card { padding: 20px 24px; margin-bottom: 16px; cursor: pointer; transition: all var(--transition); }
        .committee-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .committee-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
        .committee-info h3 { font-size: 1.1rem; font-weight: 600; }
        .committee-status { font-size: 0.65rem; padding: 2px 10px; border-radius: var(--radius-full); text-transform: uppercase; font-weight: 600; }
        .committee-status.active { background: var(--success-bg); color: var(--success); }
        .committee-status.completed { background: #dbeafe; color: #3b82f6; }
        .committee-amounts { display: flex; gap: 16px; font-size: 0.85rem; }
        .committee-amounts span { color: var(--text-muted); }
        .committee-progress { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
        .progress-bar { flex: 1; height: 4px; background: var(--border); border-radius: var(--radius-full); }
        .progress-bar { background: var(--primary-accent); }
        .committee-details { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px 16px; font-size: 0.85rem; color: var(--text-muted); margin-top: 8px; }
        .committee-details span { color: var(--text-secondary); }
        .committee-details strong { color: var(--text); }
        
        @media (max-width: 768px) {
            .bid-save-summary { grid-template-columns: 1fr; }
            .committee-details { grid-template-columns: 1fr 1fr; }
        }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function openAddCommitteeModal() {
    openModal('New Committee', `
        <form id="committeeForm">
            <div class="form-group">
                <label>Committee Name *</label>
                <input type="text" class="form-control" id="committeeName" placeholder="Saif Ki Committee" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Total Amount *</label>
                    <input type="number" class="form-control" id="committeeAmount" placeholder="₹ 2,00,000" required />
                </div>
                <div class="form-group">
                    <label>Number of Members *</label>
                    <input type="number" class="form-control" id="committeeMembers" placeholder="20" required min="1" />
                </div>
            </div>
            <div class="form-group">
                <label>Your Memberships</label>
                <input type="number" class="form-control" id="committeeMemberships" value="1" min="1" />
                <small class="text-muted">How many slots do you have in this committee?</small>
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="date" class="form-control" id="committeeStartDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div id="committeeCalculation" class="calculation-preview" style="background:var(--bg);padding:12px 16px;border-radius:var(--radius-sm);margin:12px 0;">
                <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Base Contribution</span> <strong id="calcBaseContribution">₹ 0</strong></div>
                <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Duration</span> <strong id="calcDuration">0 months</strong></div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Create Committee</button>
        </form>
    `);

    document.getElementById('committeeAmount').addEventListener('input', updateCommitteeCalc);
    document.getElementById('committeeMembers').addEventListener('input', updateCommitteeCalc);
    updateCommitteeCalc();

    document.getElementById('committeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddCommittee();
    });
}

function updateCommitteeCalc() {
    const amount = parseFloat(document.getElementById('committeeAmount').value) || 0;
    const members = parseInt(document.getElementById('committeeMembers').value) || 0;
    const base = members > 0 ? amount / members : 0;
    document.getElementById('calcBaseContribution').textContent = formatCurrency(base);
    document.getElementById('calcDuration').textContent = `${members} months`;
}

async function handleAddCommittee() {
    const name = document.getElementById('committeeName').value.trim();
    const totalAmount = parseFloat(document.getElementById('committeeAmount').value);
    const members = parseInt(document.getElementById('committeeMembers').value);
    const memberships = parseInt(document.getElementById('committeeMemberships').value) || 1;
    const startDate = document.getElementById('committeeStartDate').value;

    if (!name || !totalAmount || !members || members <= 0) {
        showToast('Please fill all required fields', 'error');
        return;
    }

    if (memberships > members) {
        showToast('Memberships cannot exceed total members', 'error');
        return;
    }

    try {
        await createCommittee({ name, totalAmount, members, memberships, startDate });
        closeModal();
        showToast('Committee created successfully!', 'success');
        await loadBidSave();
    } catch (error) {
        showToast('Failed to create committee: ' + error.message, 'error');
    }
}

async function viewCommitteeDetails(committeeId) {
    const db = getDB();
    const committee = await db.read('committees', committeeId);
    if (!committee) { showToast('Committee not found', 'error'); return; }

    const cycles = await getCommitteeCycles(committeeId);
    const memberships = await getCommitteeMemberships(committeeId);
    const stats = await getCommitteeStats(committeeId);

    let totalSaving = 0;
    let totalBidCost = 0;
    const completedCycles = cycles.filter(c => c.status === 'completed');
    for (const c of completedCycles) {
        totalSaving += c.cycleSaving || 0;
        totalBidCost += c.winningBid || 0;
    }
    const netResult = totalSaving - totalBidCost;

    let cyclesHtml = '';
    for (const cycle of cycles) {
        const isSkipped = cycle.status === 'skipped';
        const isCompleted = cycle.status === 'completed';
        cyclesHtml += `
            <div class="cycle-item" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:4px;font-size:0.85rem;">
                <span><strong>Month ${cycle.cycleNo}</strong> - ${formatMonth(cycle.month)}</span>
                <span>Bid: ${cycle.winningBid ? formatCurrency(cycle.winningBid) : '—'}</span>
                <span>Payable: ${formatCurrency(cycle.totalPayable || 0)}</span>
                ${cycle.userWon ? `<span class="text-success"><i class="fas fa-trophy"></i> Won</span>` : ''}
                <span class="cycle-status" style="font-size:0.65rem;padding:1px 8px;border-radius:var(--radius-full);${isSkipped ? 'background:var(--warning-bg);color:var(--warning);' : isCompleted ? 'background:var(--success-bg);color:var(--success);' : 'background:var(--bg);color:var(--text-muted);'}">${cycle.status}</span>
            </div>
        `;
    }

    openModal(`Committee: ${committee.name}`, `
        <div class="committee-detail">
            <div class="committee-detail-summary" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:0.9rem;">
                <div><span style="color:var(--text-muted);">Amount</span> ${formatCurrency(committee.totalAmount)}</div>
                <div><span style="color:var(--text-muted);">Members</span> ${committee.members}</div>
                <div><span style="color:var(--text-muted);">Your Memberships</span> ${memberships.length}</div>
                <div><span style="color:var(--text-muted);">Base Contribution</span> ${formatCurrency(committee.baseContribution)}</div>
                <div><span style="color:var(--text-muted);">Progress</span> ${stats.completed}/${committee.duration} months</div>
                <div><span style="color:var(--text-muted);">Total Paid</span> <strong>${formatCurrency(stats.totalPaid)}</strong></div>
                <div><span style="color:var(--text-muted);">Total Received</span> <strong>${formatCurrency(stats.totalReceived)}</strong></div>
                <div><span style="color:var(--text-muted);">Total Saving</span> <strong class="text-success">${formatCurrency(totalSaving)}</strong></div>
                <div><span style="color:var(--text-muted);">Total Bid Cost</span> <strong class="text-danger">${formatCurrency(totalBidCost)}</strong></div>
                <div><span style="color:var(--text-muted);">Net Result</span> <strong class="${netResult >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(netResult)}</strong></div>
            </div>
            <hr style="margin:12px 0;" />
            <div class="cycle-list">
                <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:8px;">Monthly Cycles</h4>
                ${cyclesHtml}
            </div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="closeModal();openAddCycleModal('${committeeId}')">
                    <i class="fas fa-plus"></i> Record Month
                </button>
                <button class="btn btn-secondary" onclick="closeModal();openSkipCycleModal('${committeeId}')">
                    <i class="fas fa-skip"></i> Skip Month
                </button>
            </div>
        </div>
    `);
}

async function openAddCycleModal(committeeId) {
    const db = getDB();
    const committee = await db.read('committees', committeeId);
    if (!committee) return;

    const nextCycle = await getNextPendingCycle(committeeId);
    if (!nextCycle) { showToast('All cycles completed!', 'info'); return; }

    const memberships = await getCommitteeMemberships(committeeId);
    const accounts = await db.readAll('accounts');

    let accountsHtml = '';
    for (const a of accounts) {
        if (a.status !== 'archived') {
            accountsHtml += `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`;
        }
    }

    openModal('Record Month', `
        <form id="cycleForm">
            <div class="cycle-form-info" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:0.85rem;background:var(--bg);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;">
                <div><span style="color:var(--text-muted);">Committee</span> <strong>${committee.name}</strong></div>
                <div><span style="color:var(--text-muted);">Month</span> <strong>${formatMonth(nextCycle.month)}</strong></div>
                <div><span style="color:var(--text-muted);">Cycle</span> <strong>${nextCycle.cycleNo}/${committee.duration}</strong></div>
                <div><span style="color:var(--text-muted);">Base Contribution</span> ${formatCurrency(committee.baseContribution)}</div>
                <div><span style="color:var(--text-muted);">Your Memberships</span> ${memberships.length}</div>
            </div>
            
            <div class="form-group">
                <label>Winning Bid</label>
                <input type="number" class="form-control" id="cycleBid" placeholder="₹ 0" value="0" />
                <small class="text-muted">Enter 0 for no bid (skip)</small>
            </div>
            
            <div class="form-group">
                <label>Did You Win?</label>
                <select class="form-control" id="cycleWon" onchange="togglePayoutSection()">
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Winner Name (Optional)</label>
                <input type="text" class="form-control" id="cycleWinnerName" placeholder="Name of winner" />
            </div>

            <div class="form-group">
                <label>Payment Account *</label>
                <select class="form-control" id="cyclePaymentAccount">
                    ${accountsHtml}
                </select>
                <small class="text-muted">Account used for your contribution</small>
            </div>

            <div id="payoutSection" style="display:none;">
                <div class="form-group">
                    <label>Payout Destination</label>
                    <select class="form-control" id="cyclePayoutAccount">
                        <option value="">Keep Outside Finora</option>
                        ${accountsHtml}
                    </select>
                    <small class="text-muted">Select an account to receive payout, or keep outside Finora</small>
                </div>
            </div>

            <div class="form-group">
                <label>Payment Date</label>
                <input type="date" class="form-control" id="cyclePaymentDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>

            <div id="cycleCalculation" style="background:var(--bg);padding:12px 16px;border-radius:var(--radius-sm);margin:12px 0;">
                <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Bid Discount</span> <strong id="calcDiscount">₹ 0</strong></div>
                <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Your Payable</span> <strong id="calcContribution">₹ 0</strong></div>
                <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Payout (if won)</span> <strong id="calcPayout">₹ 0</strong></div>
            </div>

            <button type="submit" class="btn btn-primary btn-block">Save Month</button>
        </form>
    `);

    window.togglePayoutSection = function() {
        const won = document.getElementById('cycleWon').value === 'yes';
        document.getElementById('payoutSection').style.display = won ? 'block' : 'none';
        updateCycleCalc(committee);
    };

    document.getElementById('cycleBid').addEventListener('input', () => updateCycleCalc(committee));
    document.getElementById('cycleWon').addEventListener('change', () => updateCycleCalc(committee));
    updateCycleCalc(committee);

    document.getElementById('cycleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveCycle(committeeId, nextCycle.id);
    });
}

function updateCycleCalc(committee) {
    const bid = parseFloat(document.getElementById('cycleBid').value) || 0;
    const userWon = document.getElementById('cycleWon').value === 'yes';
    const memberships = parseInt(document.getElementById('committeeMemberships')?.value) || 1;
    
    const discount = committee.members > 0 ? bid / committee.members : 0;
    const contribution = committee.baseContribution - discount;
    const payout = bid > 0 ? committee.totalAmount - bid : 0;
    const totalPayable = contribution * memberships;

    document.getElementById('calcDiscount').textContent = formatCurrency(discount);
    document.getElementById('calcContribution').textContent = formatCurrency(totalPayable);
    document.getElementById('calcPayout').textContent = userWon ? formatCurrency(payout) : '₹ 0';
}

async function handleSaveCycle(committeeId, cycleId) {
    const db = getDB();
    const committee = await db.read('committees', committeeId);
    if (!committee) return;

    const bid = parseFloat(document.getElementById('cycleBid').value) || 0;
    const userWon = document.getElementById('cycleWon').value === 'yes';
    const winnerName = document.getElementById('cycleWinnerName').value.trim();
    const paymentAccountId = document.getElementById('cyclePaymentAccount').value;
    const payoutAccountId = document.getElementById('cyclePayoutAccount').value || null;
    const paymentDate = document.getElementById('cyclePaymentDate').value;

    if (!paymentAccountId) {
        showToast('Please select a payment account', 'error');
        return;
    }

    if (bid > committee.totalAmount) {
        showToast(`Bid cannot exceed committee amount (${formatCurrency(committee.totalAmount)})`, 'error');
        return;
    }

    if (bid > 0 && bid > committee.totalAmount * 0.9) {
        if (!confirm(`⚠️ Bid amount (${formatCurrency(bid)}) is higher than recommended. Continue anyway?`)) {
            return;
        }
    }

    try {
        await recordCommitteeMonth(committeeId, cycleId, {
            winningBid: bid,
            userWon: userWon,
            winnerName: winnerName,
            paymentAccountId: paymentAccountId,
            payoutAccountId: payoutAccountId,
            paymentDate: paymentDate
        });

        closeModal();
        showToast('Month recorded successfully!', 'success');
        await loadBidSave();
    } catch (error) {
        showToast('Failed to record month: ' + error.message, 'error');
    }
}

async function openSkipCycleModal(committeeId) {
    const db = getDB();
    const committee = await db.read('committees', committeeId);
    if (!committee) return;

    const nextCycle = await getNextPendingCycle(committeeId);
    if (!nextCycle) { showToast('All cycles completed!', 'info'); return; }

    const accounts = await db.readAll('accounts');
    let accountsHtml = '';
    for (const a of accounts) {
        if (a.status !== 'archived') {
            accountsHtml += `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`;
        }
    }

    openModal('Skip Month', `
        <form id="skipForm">
            <div class="form-info" style="background:var(--bg);padding:12px 16px;border-radius:var(--radius-sm);margin-bottom:16px;">
                <div><span style="color:var(--text-muted);">Committee</span> <strong>${committee.name}</strong></div>
                <div><span style="color:var(--text-muted);">Month</span> <strong>${formatMonth(nextCycle.month)}</strong></div>
                <div><span style="color:var(--text-muted);">Cycle</span> <strong>${nextCycle.cycleNo}/${committee.duration}</strong></div>
                <div><span style="color:var(--text-muted);">Base Contribution</span> ${formatCurrency(committee.baseContribution)}</div>
            </div>
            
            <div class="form-group">
                <label>Payment Account *</label>
                <select class="form-control" id="skipPaymentAccount">
                    ${accountsHtml}
                </select>
                <small class="text-muted">Account used for your normal contribution</small>
            </div>
            
            <div class="form-group">
                <label>Payment Date</label>
                <input type="date" class="form-control" id="skipPaymentDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            
            <div style="background:var(--warning-bg);padding:12px 16px;border-radius:var(--radius-sm);margin:12px 0;">
                <span style="color:var(--warning);"><i class="fas fa-exclamation-triangle"></i> No bid will be recorded. Contribution will be normal.</span>
            </div>
            
            <button type="submit" class="btn btn-warning btn-block">Skip Month</button>
            <button type="button" class="btn btn-secondary btn-block" onclick="closeModal()">Cancel</button>
        </form>
    `);

    document.getElementById('skipForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const paymentAccountId = document.getElementById('skipPaymentAccount').value;
        const paymentDate = document.getElementById('skipPaymentDate').value;
        
        if (!paymentAccountId) {
            showToast('Please select a payment account', 'error');
            return;
        }
        
        try {
            await skipCommitteeMonth(committeeId, nextCycle.id, paymentAccountId, paymentDate);
            closeModal();
            showToast('Month skipped successfully', 'warning');
            await loadBidSave();
        } catch (error) {
            showToast('Failed to skip month: ' + error.message, 'error');
        }
    });
}

window.loadBidSave = loadBidSave;
window.openAddCommitteeModal = openAddCommitteeModal;
window.viewCommitteeDetails = viewCommitteeDetails;
window.openAddCycleModal = openAddCycleModal;
window.openSkipCycleModal = openSkipCycleModal;