// ============================================
// FINORA — Committee (v2.0 — COMPLETE)
// ============================================

// ----- CREATE COMMITTEE WITH MEMBERSHIPS -----
async function createCommittee(data) {
    const db = getDB();

    if (!data.name || !data.totalAmount || !data.members || data.members <= 0) {
        throw new Error('Please fill all required fields');
    }

    const baseContribution = data.totalAmount / data.members;
    const duration = data.members;
    const memberships = data.memberships || 1;

    const committee = {
        id: generateCommitteeId(),
        name: data.name,
        totalAmount: data.totalAmount,
        members: data.members,
        baseContribution: baseContribution,
        duration: duration,
        startDate: data.startDate || new Date().toISOString(),
        completedCycles: 0,
        totalGain: 0,
        status: 'active',
        nextCycle: data.startDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await db.create('committees', committee);

    // Create individual membership slots
    const membershipIds = [];
    for (let i = 1; i <= memberships; i++) {
        const membership = {
            id: generateMembershipId(),
            committeeId: committee.id,
            slotNo: i,
            userId: 'current_user',
            status: 'active',
            totalWins: 0,
            lastWinCycle: null,
            totalGain: 0,
            createdAt: new Date().toISOString()
        };
        await db.create('committee_memberships', membership);
        membershipIds.push(membership.id);
    }

    // Generate cycles
    await generateCommitteeCycles(committee.id, duration, baseContribution, data.startDate);

    return committee;
}

// ----- GENERATE CYCLES -----
async function generateCommitteeCycles(committeeId, duration, baseContribution, startDate) {
    const db = getDB();
    const cycles = [];
    let cycleDate = new Date(startDate);

    for (let i = 1; i <= duration; i++) {
        cycles.push({
            id: `CYCLE-${Date.now()}-${i}`,
            committeeId: committeeId,
            cycleNo: i,
            month: cycleDate.toISOString(),
            status: 'pending',
            winningBid: null,
            discount: 0,
            contribution: baseContribution,
            payable: baseContribution, // Will be multiplied by memberships
            userWon: false,
            payout: 0,
            contributionSaving: 0,
            bidCost: 0,
            netGain: 0,
            winnerName: null,
            transactionId: null,
            payoutTransactionId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        cycleDate.setMonth(cycleDate.getMonth() + 1);
    }

    await db.bulkCreate('committee_cycles', cycles);
    return cycles;
}

// ----- GET COMMITTEE CYCLES -----
async function getCommitteeCycles(committeeId) {
    const db = getDB();
    const cycles = await db.getByIndex('committee_cycles', 'idx_committeeId', committeeId);
    return cycles.sort((a, b) => a.cycleNo - b.cycleNo);
}

async function getCommitteeMemberships(committeeId) {
    const db = getDB();
    return await db.getByIndex('committee_memberships', 'idx_committeeId', committeeId);
}

async function getNextPendingCycle(committeeId) {
    const cycles = await getCommitteeCycles(committeeId);
    return cycles.filter(c => c.status === 'pending').sort((a, b) => a.cycleNo - b.cycleNo)[0] || null;
}

// ----- RECORD COMMITTEE MONTH (FIXED) -----
async function recordCommitteeMonth(committeeId, cycleId, data) {
    const db = getDB();

    const committee = await db.read('committees', committeeId);
    const cycle = await db.read('committee_cycles', cycleId);
    if (!committee || !cycle) throw new Error('Committee or cycle not found');

    const { winningBid, userWon, winnerName, accountId, paymentDate } = data;
    const memberships = await getCommitteeMemberships(committeeId);
    const membershipCount = memberships.length;

    // --- CALCULATIONS (LOCKED) ---
    const discount = calculateBidDiscount(winningBid, committee.members);
    const actualContribution = calculateActualContribution(committee.baseContribution, winningBid, committee.members);
    const payable = calculateTotalPayable(actualContribution, membershipCount);
    const payout = calculatePayout(committee.totalAmount, winningBid);
    const contributionSaving = calculateContributionSaving(committee.baseContribution, winningBid, committee.members) * membershipCount;
    const bidCost = userWon ? winningBid : 0;
    const netGain = calculateCycleNetGain(committee.totalGain || 0, contributionSaving, winningBid, userWon);

    // --- VALIDATION: One win per month ---
    if (userWon) {
        // Check if user already won this month in any committee
        const allCycles = await db.readAll('committee_cycles');
        const sameMonthWins = allCycles.filter(c => 
            c.month === cycle.month && 
            c.userWon === true && 
            c.id !== cycle.id
        );
        if (sameMonthWins.length > 0) {
            throw new Error('You already won in another committee this month. One win per month allowed.');
        }

        // Check if user reached max wins
        const totalWins = allCycles.filter(c => c.userWon === true && c.committeeId === committeeId).length;
        if (totalWins >= membershipCount) {
            throw new Error('You have reached maximum wins for this committee.');
        }
    }

    // --- LEDGER TRANSACTION (PAYMENT) ---
    const txn = await createLedgerEntry({
        type: LEDGER_TYPES.COMMITTEE_PAYMENT,
        direction: LEDGER_DIRECTIONS.OUT,
        amount: payable,
        accountId: accountId,
        date: paymentDate || cycle.month,
        description: `${committee.name} - Month ${cycle.cycleNo} Contribution`,
        module: 'bid_save',
        moduleRef: committeeId,
        status: LEDGER_STATUS.COMPLETED
    });

    // --- LEDGER TRANSACTION (PAYOUT - if won) ---
    let payoutTxn = null;
    if (userWon && payout > 0) {
        payoutTxn = await createLedgerEntry({
            type: LEDGER_TYPES.COMMITTEE_PAYOUT,
            direction: LEDGER_DIRECTIONS.IN,
            amount: payout,
            accountId: accountId,
            date: paymentDate || cycle.month,
            description: `${committee.name} - Month ${cycle.cycleNo} Payout`,
            module: 'bid_save',
            moduleRef: committeeId,
            status: LEDGER_STATUS.COMPLETED
        });
    }

    // --- UPDATE CYCLE ---
    cycle.winningBid = winningBid;
    cycle.discount = discount;
    cycle.contribution = actualContribution;
    cycle.payable = payable;
    cycle.userWon = userWon;
    cycle.payout = payout;
    cycle.contributionSaving = contributionSaving;
    cycle.bidCost = bidCost;
    cycle.netGain = netGain - (committee.totalGain || 0);
    cycle.winnerName = winnerName || null;
    cycle.status = 'completed';
    cycle.transactionId = txn.id;
    cycle.payoutTransactionId = payoutTxn ? payoutTxn.id : null;
    cycle.updatedAt = new Date().toISOString();
    await db.update('committee_cycles', cycle);

    // --- UPDATE MEMBERSHIP (if won) ---
    if (userWon) {
        const membershipsList = await getCommitteeMemberships(committeeId);
        // Find the first available membership that hasn't won
        for (const m of membershipsList) {
            if (!m.lastWinCycle) {
                m.totalWins = (m.totalWins || 0) + 1;
                m.lastWinCycle = cycle.cycleNo;
                m.totalGain = (m.totalGain || 0) + cycle.netGain;
                await db.update('committee_memberships', m);
                break;
            }
        }
    }

    // --- UPDATE COMMITTEE ---
    committee.completedCycles = (committee.completedCycles || 0) + 1;
    committee.totalGain = netGain;
    committee.updatedAt = new Date().toISOString();

    if (committee.completedCycles >= committee.duration) {
        committee.status = 'completed';
    } else {
        const nextPending = await getNextPendingCycle(committeeId);
        if (nextPending) committee.nextCycle = nextPending.month;
    }
    await db.update('committees', committee);

    return { cycle, committee, txn, payoutTxn };
}

// ----- SKIP COMMITTEE MONTH (FIXED) -----
async function skipCommitteeMonth(committeeId, cycleId) {
    const db = getDB();

    const committee = await db.read('committees', committeeId);
    const cycle = await db.read('committee_cycles', cycleId);
    if (!committee || !cycle) throw new Error('Committee or cycle not found');

    const memberships = await getCommitteeMemberships(committeeId);
    const membershipCount = memberships.length;

    // --- SKIP LOGIC (LOCKED) ---
    // Bid = 0, Discount = 0, Contribution = Normal (Base), Payout = 0, Gain = 0
    const payable = committee.baseContribution * membershipCount;

    // --- LEDGER TRANSACTION (Normal contribution) ---
    const txn = await createLedgerEntry({
        type: LEDGER_TYPES.COMMITTEE_PAYMENT,
        direction: LEDGER_DIRECTIONS.OUT,
        amount: payable,
        accountId: committee.accountId || 'default',
        date: cycle.month,
        description: `${committee.name} - Month ${cycle.cycleNo} (Skipped - No Bid)`,
        module: 'bid_save',
        moduleRef: committeeId,
        status: LEDGER_STATUS.COMPLETED
    });

    // --- UPDATE CYCLE ---
    cycle.winningBid = 0;
    cycle.discount = 0;
    cycle.contribution = committee.baseContribution;
    cycle.payable = payable;
    cycle.userWon = false;
    cycle.payout = 0;
    cycle.contributionSaving = 0;
    cycle.bidCost = 0;
    cycle.netGain = 0;
    cycle.status = 'skipped';
    cycle.transactionId = txn.id;
    cycle.updatedAt = new Date().toISOString();
    await db.update('committee_cycles', cycle);

    // --- UPDATE COMMITTEE ---
    committee.completedCycles = (committee.completedCycles || 0) + 1;
    committee.updatedAt = new Date().toISOString();

    if (committee.completedCycles >= committee.duration) {
        committee.status = 'completed';
    } else {
        const nextPending = await getNextPendingCycle(committeeId);
        if (nextPending) committee.nextCycle = nextPending.month;
    }
    await db.update('committees', committee);

    return { cycle, committee, txn };
}

// ----- GET COMMITTEE STATS -----
async function getCommitteeStats(committeeId) {
    const cycles = await getCommitteeCycles(committeeId);
    const completed = cycles.filter(c => c.status === 'completed');
    const pending = cycles.filter(c => c.status === 'pending');

    return {
        totalCycles: cycles.length,
        completed: completed.length,
        pending: pending.length,
        totalPaid: completed.reduce((s, c) => s + (c.payable || 0), 0),
        totalReceived: completed.reduce((s, c) => s + (c.payout || 0), 0),
        totalGain: completed.reduce((s, c) => s + (c.netGain || 0), 0),
        progress: cycles.length > 0 ? (completed.length / cycles.length * 100) : 0
    };
}