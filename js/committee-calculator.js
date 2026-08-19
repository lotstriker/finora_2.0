// ============================================
// FINORA — Committee Calculator (v2.0) — COMPLETE
// ============================================

function calculateBaseContribution(totalAmount, members) {
    if (members <= 0) return 0;
    return totalAmount / members;
}

function calculateBidDiscount(winningBid, members) {
    if (members <= 0 || winningBid <= 0) return 0;
    return winningBid / members;
}

function calculateActualContribution(baseContribution, winningBid, members) {
    const discount = calculateBidDiscount(winningBid, members);
    return Math.max(0, baseContribution - discount);
}

function calculateTotalPayable(actualContribution, membershipCount) {
    return actualContribution * membershipCount;
}

function calculatePayout(totalAmount, winningBid) {
    if (winningBid <= 0 || winningBid > totalAmount) return 0;
    return totalAmount - winningBid;
}

function calculateContributionSaving(baseContribution, winningBid, members) {
    const discount = calculateBidDiscount(winningBid, members);
    return Math.max(0, discount);
}

function validateBid(bid, minBid = null, maxBid = null) {
    const result = { valid: true, warnings: [] };
    if (bid < 0) { 
        result.valid = false; 
        result.warnings.push('Bid cannot be negative'); 
    }
    if (minBid !== null && bid < minBid) {
        result.warnings.push(`Bid is below minimum allowed (${formatCurrency(minBid)})`);
    }
    if (maxBid !== null && bid > maxBid) {
        result.warnings.push(`Bid exceeds maximum allowed (${formatCurrency(maxBid)})`);
    }
    return result;
}

function canUserWinThisMonth(userWinsByMonth, month) {
    return !userWinsByMonth[month];
}

function getCommitteeProgress(completedCycles, totalCycles) {
    const remaining = Math.max(0, totalCycles - completedCycles);
    const progress = totalCycles > 0 ? (completedCycles / totalCycles * 100) : 0;
    return { completed: completedCycles, remaining, total: totalCycles, progress: Math.min(progress, 100) };
}