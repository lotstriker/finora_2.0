// ============================================
// FINORA — Bid & Save (v2.0)
// ============================================

async function loadBidSave() {
    const container = document.getElementById('pageContainer');
    const db = getDB();
    const committees = await db.readAll('committees');

    const html = `
        <div class="bid-save-page">
            <div class="page-header">
                <h2>Bid & Save</h2>
                <button class="btn btn-primary" onclick="openAddCommitteeModal()">
                    <i class="fas fa-plus"></i> New Committee
                </button>
            </div>

            ${committees.length > 0 ? committees.map(c => {
                const progress = ((c.completedCycles || 0) / c.duration * 100);
                return `
                    <div class="committee-card card" onclick="viewCommitteeDetails('${c.id}')">
                        <div class="committee-header">
                            <div>
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
                            <span>${c.completedCycles || 0}/${c.duration} months</span>
                        </div>
                        <div class="committee-footer">
                            <span>Base: ${formatCurrency(c.baseContribution)}</span>
                            <span>·</span>
                            <span>Gain: <strong class="${(c.totalGain || 0) >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(c.totalGain || 0)}</strong></span>
                            <span>·</span>
                            <span>Next: ${c.nextCycle ? formatMonth(c.nextCycle) : '—'}</span>
                        </div>
                    </div>
                `;
            }).join('') : `
                <div class="empty-state">
                    <i class="fas fa-handshake"></i>
                    <p>No committees yet</p>
                    <button class="btn btn-primary" onclick="openAddCommitteeModal()">Start a Committee</button>
                </div>
            `}
        </div>
    `;

    container.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
        .committee-card { padding: 20px 24px; margin-bottom: 16px; cursor: pointer; transition: all var(--transition); }
        .committee-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .committee-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
        .committee-header h3 { font-size: 1.1rem; font-weight: 600; }
        .committee-status { font-size: 0.7rem; padding: 2px 10px; border-radius: 12px; text-transform: uppercase; font-weight: 600; }
        .committee-status.active { background: #dcfce7; color: #22c55e; }
        .committee-status.completed { background: #dbeafe; color: #3b82f6; }
        .committee-amounts { display: flex; gap: 16px; font-size: 0.9rem; }
        .committee-amounts span { color: var(--text-muted); }
        .committee-progress { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
        .committee-footer { font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    `;
    document.getElementById('page-style').textContent = style.textContent;
}

async function openAddCommitteeModal() {
    openModal('New Committee', `
        <form id="committeeForm">
            <div class="form-group">
                <label>Committee Name</label>
                <input type="text" class="form-control" id="committeeName" placeholder="Saif Ki Committee" required />
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Total Amount</label>
                    <input type="number" class="form-control" id="committeeAmount" placeholder="₹ 2,00,000" required />
                </div>
                <div class="form-group">
                    <label>Number of Members</label>
                    <input type="number" class="form-control" id="committeeMembers" placeholder="20" required min="1" />
                </div>
            </div>
            <div class="form-group">
                <label>Your Memberships</label>
                <input type="number" class="form-control" id="committeeMemberships" value="1" min="1" />
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="date" class="form-control" id="committeeStartDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div id="committeeCalculation" class="calculation-preview">
                <div><span>Base Contribution</span> <strong id="calcBaseContribution">₹ 0</strong></div>
                <div><span>Duration</span> <strong id="calcDuration">0 months</strong></div>
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

    openModal(`Committee: ${committee.name}`, `
        <div class="committee-detail">
            <div class="committee-detail-summary">
                <div><span>Amount</span> ${formatCurrency(committee.totalAmount)}</div>
                <div><span>Members</span> ${committee.members}</div>
                <div><span>Your Memberships</span> ${memberships.length}</div>
                <div><span>Base Contribution</span> ${formatCurrency(committee.baseContribution)}</div>
                <div><span>Progress</span> ${stats.completed}/${committee.duration} months</div>
                <div><span>Total Paid</span> <strong>${formatCurrency(stats.totalPaid)}</strong></div>
                <div><span>Total Received</span> <strong>${formatCurrency(stats.totalReceived)}</strong></div>
                <div><span>Net Gain</span> <strong class="${stats.totalGain >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(stats.totalGain)}</strong></div>
            </div>
            <hr />
            <div class="cycle-list">
                <h4>Monthly Cycles</h4>
                ${cycles.map(cycle => `
                    <div class="cycle-item ${cycle.status}">
                        <span>Month ${cycle.cycleNo}: ${formatMonth(cycle.month)}</span>
                        <span>Bid: ${cycle.winningBid ? formatCurrency(cycle.winningBid) : '—'}</span>
                        <span>Payable: ${formatCurrency(cycle.payable || 0)}</span>
                        ${cycle.userWon ? `<span class="text-success">🏆 Won</span>` : ''}
                        <span class="cycle-status ${cycle.status}">${cycle.status}</span>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-primary" onclick="closeModal();openAddCycleModal('${committeeId}')">
                <i class="fas fa-plus"></i> Record Month
            </button>
            <button class="btn btn-secondary" onclick="closeModal();openSkipCycleModal('${committeeId}')">
                <i class="fas fa-skip"></i> Skip Month
            </button>
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

    openModal('Record Month', `
        <form id="cycleForm">
            <div class="cycle-form-info">
                <div><span>Committee</span> <strong>${committee.name}</strong></div>
                <div><span>Month</span> <strong>${formatMonth(nextCycle.month)}</strong></div>
                <div><span>Cycle</span> <strong>${nextCycle.cycleNo}/${committee.duration}</strong></div>
                <div><span>Base Contribution</span> ${formatCurrency(committee.baseContribution)}</div>
                <div><span>Your Memberships</span> ${memberships.length}</div>
            </div>
            <div class="form-group">
                <label>Winning Bid</label>
                <input type="number" class="form-control" id="cycleBid" placeholder="₹ 0" value="0" />
                <small class="text-muted">Enter 0 for no bid</small>
            </div>
            <div class="form-group">
                <label>Did You Win?</label>
                <select class="form-control" id="cycleWon">
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                </select>
            </div>
            <div class="form-group">
                <label>Winner Name (Optional)</label>
                <input type="text" class="form-control" id="cycleWinnerName" placeholder="Name of winner" />
            </div>
            <div class="form-group">
                <label>Account (for payment)</label>
                <select class="form-control" id="cycleAccount">
                    ${(await db.readAll('accounts')).map(a => 
                        `<option value="${a.id}">${a.name} (${formatCurrency(a.balance || 0)})</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Payment Date</label>
                <input type="date" class="form-control" id="cyclePaymentDate" value="${new Date().toISOString().split('T')[0]}" />
            </div>
            <div id="cycleCalculation" class="calculation-preview">
                <div><span>Bid Discount</span> <strong id="calcDiscount">₹ 0</strong></div>
                <div><span>Your Contribution</span> <strong id="calcContribution">₹ 0</strong></div>
                <div><span>Payout (if won)</span> <strong id="calcPayout">₹ 0</strong></div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save Month</button>
        </form>
    `);

    document.getElementById('cycleBid').addEventListener('input', () => updateCycleCalc(committee));
    updateCycleCalc(committee);

    document.getElementById('cycleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSaveCycle(committeeId, nextCycle.id);
    });
}

function updateCycleCalc(committee) {
    const bid = parseFloat(document.getElementById('cycleBid').value) || 0;
    const discount = committee.members > 0 ? bid / committee.members : 0;
    const contribution = committee.baseContribution - discount;
    const payout = bid > 0 ? committee.totalAmount - bid : 0;

    document.getElementById('calcDiscount').textContent = formatCurrency(discount);
    document.getElementById('calcContribution').textContent = formatCurrency(contribution);
    document.getElementById('calcPayout').textContent = formatCurrency(payout);
}

async function handleSaveCycle(committeeId, cycleId) {
    const bid = parseFloat(document.getElementById('cycleBid').value) || 0;
    const userWon = document.getElementById('cycleWon').value === 'yes';
    const winnerName = document.getElementById('cycleWinnerName').value.trim();
    const accountId = document.getElementById('cycleAccount').value;
    const paymentDate = document.getElementById('cyclePaymentDate').value;

    try {
        await recordCommitteeMonth(committeeId, cycleId, {
            winningBid: bid,
            userWon: userWon,
            winnerName: winnerName,
            accountId: accountId,
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

    if (confirm(`Skip month ${nextCycle.cycleNo} (${formatMonth(nextCycle.month)})? No bid will be recorded.`)) {
        try {
            await skipCommitteeMonth(committeeId, nextCycle.id);
            showToast('Month skipped successfully', 'warning');
            await loadBidSave();
        } catch (error) {
            showToast('Failed to skip month: ' + error.message, 'error');
        }
    }
}

window.loadBidSave = loadBidSave;
window.openAddCommitteeModal = openAddCommitteeModal;