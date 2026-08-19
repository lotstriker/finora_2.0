// ============================================
// FINORA — IndexedDB Helper (v2.0)
// ============================================

class IndexedDBHelper {
    constructor(dbName, version, stores) {
        this.dbName = dbName;
        this.version = version;
        this.stores = stores;
        this.db = null;
    }

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.stores.forEach(storeConfig => {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        const store = db.createObjectStore(storeConfig.name, {
                            keyPath: storeConfig.keyPath || 'id',
                            autoIncrement: storeConfig.autoIncrement || false
                        });
                        if (storeConfig.indexes) {
                            storeConfig.indexes.forEach(idx => {
                                store.createIndex(idx.name, idx.keyPath, {
                                    unique: idx.unique || false,
                                    multiEntry: idx.multiEntry || false
                                });
                            });
                        }
                    }
                });
            };
        });
    }

    async ensureOpen() {
        if (!this.db) await this.open();
        return this.db;
    }

    // ----- ATOMIC TRANSACTION -----
    async atomicTransaction(storeNames, callback) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeNames, 'readwrite');
            const stores = {};
            storeNames.forEach(name => {
                stores[name] = tx.objectStore(name);
            });
            
            const result = callback(stores, tx);
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
        });
    }

    // ----- CRUD -----
    async create(storeName, data) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async read(storeName, id) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async readAll(storeName) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async bulkCreate(storeName, dataArray) {
        const db = await this.ensureOpen();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const promises = dataArray.map(data => {
            return new Promise((resolve, reject) => {
                const req = store.add(data);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        });
        return Promise.all(promises);
    }

    async clearStore(storeName) {
        const db = await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async exportAll() {
        const db = await this.ensureOpen();
        const data = {};
        for (const store of this.stores) {
            data[store.name] = await this.readAll(store.name);
        }
        return data;
    }

    async importAll(data) {
        const db = await this.ensureOpen();
        for (const store of this.stores) {
            if (data[store.name]) {
                await this.clearStore(store.name);
                if (data[store.name].length > 0) {
                    await this.bulkCreate(store.name, data[store.name]);
                }
            }
        }
        return true;
    }
}