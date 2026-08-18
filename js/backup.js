// ============================================
// FINORA — Backup & Restore (v2.0) — FIXED
// ============================================

// ✅ AES-256-GCM encryption using Web Crypto API
async function encryptData(data, password) {
    const encoder = new TextEncoder();
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256
        },
        false,
        ['encrypt']
    );
    
    const plaintext = encoder.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        plaintext
    );
    
    const combined = new Uint8Array(16 + 12 + new Uint8Array(ciphertext).length);
    combined.set(salt, 0);
    combined.set(iv, 16);
    combined.set(new Uint8Array(ciphertext), 28);
    
    return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedData, password) {
    try {
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);
        
        const encoder = new TextEncoder();
        
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['decrypt']
        );
        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            ciphertext
        );
        
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
        throw new Error('Incorrect password or corrupted backup');
    }
}

async function exportBackup() {
    try {
        const data = await exportDatabase();
        const password = prompt('Set a password for encryption:');
        
        if (!password || password.length < 4) {
            showToast('Password must be at least 4 characters', 'error');
            return;
        }
        
        const passwordConfirm = prompt('Confirm password:');
        if (password !== passwordConfirm) {
            showToast('Passwords do not match', 'error');
            return;
        }
        
        const encrypted = await encryptData(data, password);
        
        const backupData = {
            version: 2,
            algorithm: 'AES-256-GCM',
            kdf: 'PBKDF2',
            timestamp: new Date().toISOString(),
            data: encrypted
        };
        
        const filename = `finora-backup-${new Date().toISOString().split('T')[0]}.finora`;
        downloadFile(JSON.stringify(backupData, null, 2), filename, 'application/octet-stream');
        showToast('Encrypted backup exported successfully!', 'success');
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
                let jsonData;
                let rawData = ev.target.result;
                
                if (file.name.endsWith('.finora')) {
                    const backupObj = JSON.parse(rawData);
                    
                    if (backupObj.version !== 2) {
                        showToast('This backup format is not supported', 'error');
                        return;
                    }
                    
                    const password = prompt('Enter backup password:');
                    if (!password) {
                        showToast('Password required', 'error');
                        return;
                    }
                    
                    try {
                        jsonData = await decryptData(backupObj.data, password);
                    } catch (error) {
                        showToast('Incorrect password or corrupted backup', 'error');
                        return;
                    }
                } else {
                    jsonData = JSON.parse(rawData);
                }
                
                openModal('Restore Backup', `
                    <div class="restore-options">
                        <p style="margin-bottom:16px;color:var(--text-secondary);">
                            How should Finora restore this backup?
                        </p>
                        <button class="btn btn-primary btn-block" onclick="handleRestore('replace')" style="margin-bottom:8px;">
                            <i class="fas fa-upload"></i> Replace Existing Data
                            <small style="display:block;font-weight:400;font-size:0.8rem;">Existing financial data will be replaced.</small>
                        </button>
                        <button class="btn btn-secondary btn-block" onclick="handleRestore('merge')" style="margin-bottom:8px;">
                            <i class="fas fa-code-branch"></i> Merge With Existing Data
                            <small style="display:block;font-weight:400;font-size:0.8rem;">Existing records will be preserved. Duplicates skipped.</small>
                        </button>
                        <button class="btn btn-danger btn-block" onclick="closeModal()">
                            Cancel
                        </button>
                    </div>
                `);
                
                window._pendingRestore = { data: jsonData };
                
            } catch (error) {
                showToast('Failed to restore: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function handleRestore(mode) {
    const jsonData = window._pendingRestore.data;
    if (!jsonData) {
        showToast('No backup data found', 'error');
        return;
    }
    
    closeModal();
    
    if (mode === 'replace') {
        confirmAction('⚠️ This will replace ALL existing data. This action cannot be undone.', async () => {
            try {
                await importDatabase(jsonData);
                showToast('Data restored successfully! (Replace)', 'success');
                await loadSettings();
                await navigateTo('dashboard');
            } catch (error) {
                showToast('Failed to restore: ' + error.message, 'error');
            }
        });
    } else if (mode === 'merge') {
        try {
            const db = getDB();
            let mergedCount = 0;
            let skippedCount = 0;
            
            for (const [storeName, records] of Object.entries(jsonData)) {
                if (storeName === 'settings' || storeName === 'categories') continue;
                
                const existing = await db.readAll(storeName);
                const existingIds = new Set(existing.map(r => r.id));
                
                const newRecords = records.filter(r => !existingIds.has(r.id));
                const skipped = records.length - newRecords.length;
                
                if (newRecords.length > 0) {
                    await db.bulkCreate(storeName, newRecords);
                    mergedCount += newRecords.length;
                }
                skippedCount += skipped;
            }
            
            showToast(`Merge completed! ${mergedCount} records imported, ${skippedCount} skipped (duplicates).`, 'success');
            await loadSettings();
            await navigateTo('dashboard');
        } catch (error) {
            showToast('Failed to merge: ' + error.message, 'error');
        }
    }
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
window.handleRestore = handleRestore;
window.exportCSV = exportCSV;
