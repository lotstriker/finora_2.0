// ============================================
// FINORA — Utilities (v2.0) — COMPLETE
// ============================================

function formatCurrency(amount) {
    const currency = localStorage.getItem('finora_currency') || '₹';
    const formatted = Math.abs(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    return `${currency} ${formatted}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatMonth(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getMonthYear(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getMonthStart(dateStr) {
    const d = new Date(dateStr);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d.toISOString().split('T')[0];
}

function getMonthEnd(dateStr) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    d.setHours(23,59,59,999);
    return d.toISOString().split('T')[0];
}

function toLocalDate(dateStr) {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
}

function addMonthsPreservingDay(date, months) {
    const d = new Date(date);
    const targetDay = d.getDate();
    
    d.setMonth(d.getMonth() + months);
    
    if (d.getDate() !== targetDay) {
        d.setDate(0);
    }
    
    return d;
}

function formatSourceType(source) {
    const map = {
        'income': 'Income',
        'transfer': 'Transfer',
        'person_repayment': 'Person Repayment',
        'external_funding': 'External Funding',
        'opening_balance': 'Opening Balance'
    };
    return map[source] || source;
}

function generateTxnId() {
    const d = new Date();
    const year = d.getFullYear();
    const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    return `TXN-${year}-${random}`;
}

function generateAccountId() {
    return `ACC-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3,'0')}`;
}

function generateLoanId() {
    return `LOAN-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3,'0')}`;
}

function generateCommitteeId() {
    return `COM-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3,'0')}`;
}

function generateMembershipId() {
    return `MEM-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3,'0')}`;
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function openModal(title, content) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    if (!overlay || !titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = content;
    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
}

function getTheme() {
    return localStorage.getItem('finora_theme') || 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finora_theme', theme);
}

function toggleTheme() {
    const current = getTheme();
    setTheme(current === 'light' ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = getTheme() === 'dark';
    btn.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
}

function getCurrency() {
    return localStorage.getItem('finora_currency') || '₹';
}

function setCurrency(currency) {
    localStorage.setItem('finora_currency', currency);
}

function downloadFile(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function confirmAction(message, callback) {
    if (confirm(message)) callback();
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function groupBy(array, key) {
    return array.reduce((acc, item) => {
        const group = item[key];
        if (!acc[group]) acc[group] = [];
        acc[group].push(item);
        return acc;
    }, {});
}

function sum(array, key) {
    return array.reduce((acc, item) => acc + (item[key] || 0), 0);
}