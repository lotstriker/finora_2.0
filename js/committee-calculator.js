// ============================================
// FINORA — Committee Calculator (v2.0 — LOCKED)
// ============================================

/**
 * Calculate base contribution per member
 */
function calculateBaseContribution(totalAmount, members) {
    if (members <= 0) return 0;
    return totalAmount / members;
}

/**
 * Calculate discount from winning bid
 */
function calculateBidDiscount(winningBid, members) {
    if (members <= 0 || winningBid <= 0) return 0;
    return winningBid / members;
}

/**
 * Calculate actual contribution per membership after bid
 */
function calculateActualContribution(baseContribution, winningBid, members) {
    const discount = calculateBidDiscount(winningBid, members);
    return Math.max(0, baseContribution - discount);
}

/**
 * Calculate total payable for user with multiple memberships
 */
function calculateTotalPayable(actualContribution, membershipCount) {
    return actualContribution * membershipCount;
}

/**
 * Calculate payout to winner
 */
function calculatePayout(totalAmount, winningBid) {
    if (winningBid <= 0 || winningBid > totalAmount) return 0;
    return totalAmount - winningBid;
}

/**
 * Calculate contribution saving per membership
 */
function calculateContributionSaving(baseContribution, winningBid, members) {
    const discount = calculateBidDiscount(winningBid, members);
    return Math.max(0, discount);
}

/**
 * Validate bid against limits (warning only, not blocking)
 */
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

/**
 * Check if user can win this month (max 1 win per month per committee)
 */
function canUserWinThisMonth(userWinsByMonth, month) {
    return !userWinsByMonth[month];
}

/**
 * Get committee progress
 */
function getCommitteeProgress(completedCycles, totalCycles) {
    const remaining = Math.max(0, totalCycles - completedCycles);
    const progress = totalCycles > 0 ? (completedCycles / totalCycles * 100) : 0;
    return { completed: completedCycles, remaining, total: totalCycles, progress: Math.min(progress, 100) };
}
