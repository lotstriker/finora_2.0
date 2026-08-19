// ============================================
// FINORA — Committee (v2.0) — COMPLETE
// ============================================

async function createCommittee(data) {
    const db = getDB();

    if (!data.name || !data.totalAmount || !data.members || data.members <= 0) {
        throw new Error('Please fill all required fields');
    }

    if (data.memberships > data.members) {
        throw new Error('Memberships cannot exceed total members');
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
        totalBidCost: 0,
        status: 'active',
        nextCycle: data.startDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await db.create('committees', committee);

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
            lastPayoutAccountId: null,
            createdAt: new Date().toISOString()
        };
        await db.create('committee_memberships', membership);
        membershipIds.push(membership.id);
    }

    await generateCommitteeCycles(committee.id, duration, baseContribution, data.startDate);

    return committee;
}

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
            baseContribution: baseContribution,
            winningBid: null,
            discountPerMembership: 0,
            payablePerMembership: baseContribution,
            totalPayable: baseContribution,
            payout: 0,
            cycleSaving: 0,
            cumulativeGain: 0,
            cumulativeBidCost: 0,
            netResult: 0,
            userWon: false,
            winnerName: null,
            transactionId: null,
            payoutTransactionId: null,
            paymentAccountId: null,
            payoutAccountId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        cycleDate = addMonthsPreservingDay(cycleDate, 1);
    }

    await db.bulkCreate('committee_cycles', cycles);
    return cycles;
}

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

async function recordCommitteeMonth(committeeId, cycleId, data) {
    const db = getDB();

    const committee = await db.read('committees', committeeId);
    const cycle = await db.read('committee_cycles', cycleId);
    if (!committee || !cycle) throw new Error('Committee or cycle not found');

    const { 
        winningBid, 
        userWon, 
        winnerName, 
        paymentAccountId,
        payoutAccountId,
        paymentDate 
    } = data;
    
    if (!paymentAccountId) {
        throw new Error('Payment account is required');
    }

    const memberships = await getCommitteeMemberships(committeeId);
    const membershipCount = memberships.length;
    const members = committee.members;

    const discountPerMembership = winningBid > 0 ? winningBid / members : 0;
    const payablePerMembership = committee.baseContribution - discountPerMembership;
    const totalPayable = payablePerMembership * membershipCount;
    const payout = winningBid > 0 ? committee.totalAmount - winningBid : 0;
    const cycleSaving = discountPerMembership * membershipCount;

    const allCycles = await getCommitteeCycles(committeeId);
    const completedCycles = allCycles.filter(c => c.status === 'completed');
    const previousGain = completedCycles.reduce((sum, c) => sum + (c.cycleSaving || 0), 0);
    const previousBidCost = completedCycles.reduce((sum, c) => sum + (c.winningBid || 0), 0);

    const cumulativeGain = previousGain + cycleSaving;
    const cumulativeBidCost = previousBidCost + (userWon ? winningBid : 0);
    const netResult = cumulativeGain - cumulativeBidCost;

    if (userWon) {
        const existingWins = await db.getByIndex('committee_cycles', 'idx_month', cycle.month);
        const userWinsThisMonth = existingWins.filter(c => 
            c.userWon === true && 
            c.committeeId === committeeId &&
            c.id !== cycle.id
        );
        if (userWinsThisMonth.length > 0) {
            throw new Error('One win per month per committee allowed.');
        }
    }

    const txn = await createLedgerEntry({
        type: LEDGER_TYPES.COMMITTEE_PAYMENT,
        direction: LEDGER_DIRECTIONS.OUT,
        amount: totalPayable,
        accountId: paymentAccountId,
        date: paymentDate || cycle.month,
        description: `${committee.name} - Month ${cycle.cycleNo} Contribution`,
        module: 'bid_save',
        moduleRef: committeeId,
        status: LEDGER_STATUS.COMPLETED
    });

    let payoutTxn = null;
    if (userWon && payout > 0 && payoutAccountId) {
        payoutTxn = await createLedgerEntry({
            type: LEDGER_TYPES.COMMITTEE_PAYOUT,
            direction: LEDGER_DIRECTIONS.IN,
            amount: payout,
            accountId: payoutAccountId,
            date: paymentDate || cycle.month,
            description: `${committee.name} - Month ${cycle.cycleNo} Payout`,
            module: 'bid_save',
            moduleRef: committeeId,
            status: LEDGER_STATUS.COMPLETED
        });
    }

    cycle.winningBid = winningBid;
    cycle.discountPerMembership = discountPerMembership;
    cycle.payablePerMembership = payablePerMembership;
    cycle.totalPayable = totalPayable;
    cycle.payout = payout;
    cycle.cycleSaving = cycleSaving;
    cycle.cumulativeGain = cumulativeGain;
    cycle.cumulativeBidCost = cumulativeBidCost;
    cycle.netResult = netResult;
    cycle.userWon = userWon;
    cycle.winnerName = winnerName || null;
    cycle.status = 'completed';
    cycle.transactionId = txn.id;
    cycle.payoutTransactionId = payoutTxn ? payoutTxn.id : null;
    cycle.paymentAccountId = paymentAccountId;
    cycle.payoutAccountId = payoutAccountId || null;
    cycle.updatedAt = new Date().toISOString();
    await db.update('committee_cycles', cycle);

    if (userWon) {
        const membershipsList = await getCommitteeMemberships(committeeId);
        for (const m of membershipsList) {
            if (!m.lastWinCycle) {
                m.totalWins = (m.totalWins || 0) + 1;
                m.lastWinCycle = cycle.cycleNo;
                m.totalGain = (m.totalGain || 0) + cycleSaving;
                m.lastPayoutAccountId = payoutAccountId || null;
                await db.update('committee_memberships', m);
                break;
            }
        }
    }

    committee.completedCycles = (committee.completedCycles || 0) + 1;
    committee.totalGain = cumulativeGain;
    committee.totalBidCost = cumulativeBidCost;
    committee.updatedAt = new Date().toISOString();

    if (committee.completedCycles >= committee.duration) {
        committee.status = 'completed';
    } else {
        const nextPending = await getNextPendingCycle(committeeId);
        if (nextPending) committee.nextCycle = nextPending.month;
    }
    await db.update('committees', committee);

    return { cycle, committee, txn, payoutTxn, payoutAccountId };
}

async function skipCommitteeMonth(committeeId, cycleId, paymentAccountId, paymentDate) {
    const db = getDB();

    const committee = await db.read('committees', committeeId);
    const cycle = await db.read('committee_cycles', cycleId);
    if (!committee || !cycle) throw new Error('Committee or cycle not found');

    if (!paymentAccountId) {
        throw new Error('Payment account is required');
    }

    const memberships = await getCommitteeMemberships(committeeId);
    const membershipCount = memberships.length;

    const totalPayable = committee.baseContribution * membershipCount;

    const allCycles = await getCommitteeCycles(committeeId);
    const completedCycles = allCycles.filter(c => c.status === 'completed');
    const previousGain = completedCycles.reduce((sum, c) => sum + (c.cycleSaving || 0), 0);
    const previousBidCost = completedCycles.reduce((sum, c) => sum + (c.winningBid || 0), 0);

    const txn = await createLedgerEntry({
        type: LEDGER_TYPES.COMMITTEE_PAYMENT,
        direction: LEDGER_DIRECTIONS.OUT,
        amount: totalPayable,
        accountId: paymentAccountId,
        date: paymentDate || cycle.month,
        description: `${committee.name} - Month ${cycle.cycleNo} (Skipped - No Bid)`,
        module: 'bid_save',
        moduleRef: committeeId,
        status: LEDGER_STATUS.COMPLETED
    });

    cycle.winningBid = 0;
    cycle.discountPerMembership = 0;
    cycle.payablePerMembership = committee.baseContribution;
    cycle.totalPayable = totalPayable;
    cycle.payout = 0;
    cycle.cycleSaving = 0;
    cycle.cumulativeGain = previousGain;
    cycle.cumulativeBidCost = previousBidCost;
    cycle.netResult = previousGain - previousBidCost;
    cycle.userWon = false;
    cycle.status = 'skipped';
    cycle.transactionId = txn.id;
    cycle.paymentAccountId = paymentAccountId;
    cycle.payoutAccountId = null;
    cycle.updatedAt = new Date().toISOString();
    await db.update('committee_cycles', cycle);

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

async function getCommitteeStats(committeeId) {
    const cycles = await getCommitteeCycles(committeeId);
    const completed = cycles.filter(c => c.status === 'completed');
    const pending = cycles.filter(c => c.status === 'pending');

    return {
        totalCycles: cycles.length,
        completed: completed.length,
        pending: pending.length,
        totalPaid: completed.reduce((s, c) => s + (c.totalPayable || 0), 0),
        totalReceived: completed.reduce((s, c) => s + (c.payout || 0), 0),
        totalSaving: completed.reduce((s, c) => s + (c.cycleSaving || 0), 0),
        totalBidCost: completed.reduce((s, c) => s + (c.winningBid || 0), 0),
        netResult: completed.reduce((s, c) => s + (c.netResult || 0), 0),
        progress: cycles.length > 0 ? (completed.length / cycles.length * 100) : 0
    };
}