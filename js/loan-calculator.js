// ============================================
// FINORA — Loan Calculator (v2.0) — COMPLETE
// ============================================

function calculateEMI(principal, annualRate, months) {
    if (!principal || principal <= 0) return 0;
    if (!months || months <= 0) return 0;
    
    if (!annualRate || annualRate === 0) {
        return principal / months;
    }
    
    const monthlyRate = annualRate / 12 / 100;
    const power = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * power) / (power - 1);
}

function calculateTotalInterest(principal, emi, months) {
    if (!principal || !emi || !months) return 0;
    return Math.max(0, (emi * months) - principal);
}

function calculateTotalPayment(emi, months) {
    return emi * months;
}

function getRemainingBalance(principal, annualRate, emi, paidMonths) {
    if (!principal || paidMonths <= 0) return principal;
    
    if (!annualRate || annualRate === 0) {
        return Math.max(0, principal - (emi * paidMonths));
    }
    
    const monthlyRate = annualRate / 12 / 100;
    const power = Math.pow(1 + monthlyRate, paidMonths);
    const balance = (principal * power) - (emi * (power - 1) / monthlyRate);
    return Math.max(0, balance);
}

function isFinalEMI(remainingBalance, monthlyEMI) {
    return remainingBalance <= monthlyEMI && remainingBalance > 0;
}

function calculateFinalEMI(remainingBalance, monthlyEMI) {
    if (remainingBalance <= 0) return 0;
    return Math.min(remainingBalance, monthlyEMI);
}

function calculateRemainingMonths(remainingBalance, emi) {
    if (remainingBalance <= 0) return 0;
    if (!emi || emi <= 0) return 0;
    return Math.ceil(remainingBalance / emi);
}

function generateAmortizationSchedule(principal, annualRate, months) {
    if (!principal || !months) return [];
    
    const monthlyRate = annualRate ? annualRate / 12 / 100 : 0;
    const emi = calculateEMI(principal, annualRate, months);
    const schedule = [];
    
    let balance = principal;
    let totalInterest = 0;
    let totalPrincipal = 0;
    
    for (let i = 1; i <= months; i++) {
        const interest = balance * monthlyRate;
        const principalPaid = emi - interest;
        balance -= principalPaid;
        totalInterest += interest;
        totalPrincipal += principalPaid;
        
        schedule.push({
            installment: i,
            emi: Math.round(emi * 100) / 100,
            principalPaid: Math.round(Math.max(0, principalPaid) * 100) / 100,
            interestPaid: Math.round(Math.max(0, interest) * 100) / 100,
            remainingBalance: Math.round(Math.max(0, balance) * 100) / 100,
            totalInterest: Math.round(totalInterest * 100) / 100,
            totalPaid: Math.round((totalPrincipal + totalInterest) * 100) / 100,
            interestPercentage: emi > 0 ? Math.round((interest / emi) * 100) : 0
        });
        
        if (balance <= 0) break;
    }
    
    return schedule;
}

function getPaymentStatusLabel(status, dueDate, paidDate) {
    if (status === 'paid') {
        return paidDate ? `Paid on ${formatDate(paidDate)}` : 'Paid';
    }
    if (status === 'pending' && dueDate) {
        const days = getDaysUntil(dueDate);
        if (days < 0) return 'Overdue';
        if (days === 0) return 'Due Today';
        if (days <= 7) return `Due in ${days} days`;
        return `Due in ${days} days`;
    }
    return 'Unknown';
}

function getDaysUntil(dateStr) {
    const today = new Date();
    const target = new Date(dateStr);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function isInstallmentOverdue(dueDate, status) {
    if (status === 'paid') return false;
    const today = new Date();
    const due = new Date(dueDate);
    return today > due;
}

function getLoanProgress(paidMonths, totalMonths) {
    const remaining = Math.max(0, totalMonths - paidMonths);
    const progress = totalMonths > 0 ? (paidMonths / totalMonths * 100) : 0;
    
    return {
        paidMonths: paidMonths,
        remainingMonths: remaining,
        totalMonths: totalMonths,
        progress: Math.min(progress, 100)
    };
}

function getNextPaymentDate(installments) {
    const pending = installments.filter(i => i.status === 'pending');
    if (pending.length === 0) return null;
    pending.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return pending[0].dueDate;
}

function getRemainingInstallments(installments) {
    return installments.filter(i => i.status === 'pending').length;
}