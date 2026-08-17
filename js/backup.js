// ============================================
// FINORA — Backup & Restore (v2.0)
// ============================================

// Simple encryption/decryption (for demo purposes)
// In production, use proper AES-256-GCM
async function encryptData(data, password) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    // Simple XOR-based encryption (for demo)
    // In production, use Web Crypto API with AES-256-GCM
    const passwordBuffer = encoder.encode(password);
    const encrypted = new Uint8Array(dataBuffer.length);

    for (let i = 0; i < dataBuffer.length; i++) {
        encrypted[i] = dataBuffer[i] ^ passwordBuffer[i % passwordBuffer.length];
    }

    return btoa(String.fromCharCode(...encrypted));
}

async function decryptData(encryptedData, password) {
    try {
        const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const decrypted = new Uint8Array(encrypted.length);

        for (let i = 0; i < encrypted.length; i++) {
            decrypted[i] = encrypted[i] ^ passwordBuffer[i % passwordBuffer.length];
        }

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    } catch (error) {
        throw new Error('Incorrect password or corrupted backup');
    }
}

async function exportBackup() {
    try {
        const data = await exportDatabase();
        const password = prompt('Set a password for encryption (optional):');

        let content;
        let filename;
        let mimeType;

        if (password && password.length > 0) {
            const encrypted = await encryptData(data, password);
            content = encrypted;
            filename = `finora-backup-${new Date().toISOString().split('T')[0]}.finora`;
            mimeType = 'application/octet-stream';
            showToast('Encrypted backup exported!', 'success');
        } else {
            content = JSON.stringify(data, null, 2);
            filename = `finora-backup-${new Date().toISOString().split('T')[0]}.json`;
            mimeType = 'application/json';
            showToast('Backup exported successfully!', 'success');
        }

        downloadFile(content, filename, mimeType);
    } catch (error) {
        showToast('Failed to export: ' + error.message, 'error');
    }
}

async function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.finora,.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                let data = ev.target.result;
                let jsonData;

                // Check if it's encrypted (.finora file)
                if (file.name.endsWith('.finora')) {
                    const password = prompt('Enter backup password:');
                    if (!password) {
                        showToast('Password required for encrypted backup', 'error');
                        return;
                    }
                    try {
                        jsonData = await decryptData(data, password);
                    } catch (error) {
                        showToast('Incorrect password or corrupted backup', 'error');
                        return;
                    }
                } else {
                    jsonData = JSON.parse(data);
                }

                const choice = confirm(
                    'Restore Mode:\n\n' +
                    'OK = Replace (existing data will be overwritten)\n' +
                    'Cancel = Merge (combine with existing data)\n\n' +
                    '⚠️ Replace will DELETE all current data!'
                );

                if (choice) {
                    await importDatabase(jsonData);
                    showToast('Data restored successfully! (Replace)', 'success');
                } else {
                    // Merge mode
                    const db = getDB();
                    const conflicts = [];

                    for (const [storeName, records] of Object.entries(jsonData)) {
                        if (storeName === 'settings' || storeName === 'categories') continue;
                        const existing = await db.readAll(storeName);
                        const existingIds = new Set(existing.map(r => r.id));
                        const newRecords = [];
                        const conflictRecords = [];

                        for (const record of records) {
                            if (existingIds.has(record.id)) {
                                conflictRecords.push(record);
                            } else {
                                newRecords.push(record);
                            }
                        }

                        if (conflictRecords.length > 0) {
                            conflicts.push({ store: storeName, count: conflictRecords.length });
                        }

                        if (newRecords.length > 0) {
                            await db.bulkCreate(storeName, newRecords);
                        }
                    }

                    if (conflicts.length > 0) {
                        showToast(`Merge completed. ${conflicts.map(c => `${c.store}: ${c.count} conflicts skipped`).join(', ')}`, 'warning');
                    } else {
                        showToast('Data merged successfully!', 'success');
                    }
                }

                // Reload current page
                await loadSettings();
            } catch (error) {
                showToast('Failed to restore: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function exportCSV(type) {
    try {
        let entries = [];
        let filename = '';

        if (type === 'transactions') {
            entries = await getLedgerEntries();
            filename = 'transactions';
        } else if (type === 'income') {
            entries = await getLedgerEntries({ type: 'income' });
            filename = 'income';
        } else if (type === 'expenses') {
            entries = await getLedgerEntries({ type: 'expense' });
            filename = 'expenses';
        } else if (type === 'committee') {
            const db = getDB();
            entries = await db.readAll('committee_cycles');
            filename = 'committee-history';
        } else if (type === 'loans') {
            const db = getDB();
            entries = await db.readAll('loan_installments');
            filename = 'loan-history';
        } else if (type === 'savings') {
            const db = getDB();
            entries = await db.readAll('savings_contributions');
            filename = 'savings-history';
        }

        if (entries.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }

        const headers = Object.keys(entries[0]).filter(k => k !== 'id');
        const rows = entries.map(e => headers.map(h => e[h] || ''));
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        downloadFile(csv, `${filename}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        showToast('CSV exported successfully!', 'success');
    } catch (error) {
        showToast('Failed to export CSV: ' + error.message, 'error');
    }
}

window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.exportCSV = exportCSV;