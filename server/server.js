import express from 'express';
import Database from 'better-sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Handle __dirname in both ESM and CJS
const currentDir = typeof __dirname !== 'undefined' 
  ? __dirname 
  : dirname(fileURLToPath(typeof import.meta !== 'undefined' ? import.meta.url : ''));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

export function startServer(dbPath, port = 0) {
  return new Promise((resolve, reject) => {
    try {
      // ===== DATABASE SETUP =====
      const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    orderNumber TEXT NOT NULL,
    clientName TEXT NOT NULL,
    clientNumber TEXT DEFAULT '',
    date TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    itemName TEXT NOT NULL,
    size TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_items_orderId ON items(orderId);
  CREATE INDEX IF NOT EXISTS idx_orders_orderNumber ON orders(orderNumber);
  CREATE INDEX IF NOT EXISTS idx_orders_clientName ON orders(clientName);
`);

// Migration: add createdAt to items if missing
try {
  db.exec("ALTER TABLE items ADD COLUMN createdAt TEXT DEFAULT ''");
  db.exec("UPDATE items SET createdAt = datetime('now') WHERE createdAt = ''");
} catch { /* column already exists */ }

// ===== AUTO BACKUP ON STARTUP =====
try {
  const backupDir = join(dirname(dbPath), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Keep max 5 backups to save disk space
  const existingBackups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
    .sort()
    .reverse();

  // Delete old backups beyond 5
  for (let i = 4; i < existingBackups.length; i++) {
    try { fs.unlinkSync(join(backupDir, existingBackups[i])); } catch { /* ignore */ }
  }

  // Create new backup only if DB has data
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get();
  if (orderCount.c > 0) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = join(backupDir, `backup_${timestamp}.db`);
    db.backup(backupPath).then(() => {
      console.log(`💾 Auto backup saved: ${backupPath}`);
    }).catch(() => { /* backup failed silently */ });
  }
} catch { /* backup dir creation failed, non-critical */ }

// ===== PREPARED STATEMENTS =====
const stmts = {
  getAllOrders: db.prepare('SELECT * FROM orders ORDER BY createdAt DESC'),
  getOrderById: db.prepare('SELECT * FROM orders WHERE id = ?'),
  getItemsByOrderId: db.prepare('SELECT * FROM items WHERE orderId = ?'),
  getOrderByNumber: db.prepare('SELECT * FROM orders WHERE orderNumber = ? ORDER BY createdAt ASC LIMIT 1'),
  insertOrder: db.prepare('INSERT INTO orders (id, orderNumber, clientName, clientNumber, date) VALUES (?, ?, ?, ?, ?)'),
  updateOrder: db.prepare('UPDATE orders SET orderNumber = ?, clientName = ?, clientNumber = ?, date = ? WHERE id = ?'),
  deleteOrder: db.prepare('DELETE FROM orders WHERE id = ?'),
  insertItem: db.prepare('INSERT INTO items (id, orderId, itemName, size, quantity, createdAt) VALUES (?, ?, ?, ?, ?, ?)'),
  updateItem: db.prepare('UPDATE items SET itemName = ?, size = ?, quantity = ? WHERE id = ?'),
  deleteItem: db.prepare('DELETE FROM items WHERE id = ?'),
  deleteItemsByOrderId: db.prepare('DELETE FROM items WHERE orderId = ?'),
  searchOrders: db.prepare(`
    SELECT DISTINCT o.* FROM orders o 
    LEFT JOIN items i ON o.id = i.orderId 
    WHERE o.orderNumber LIKE ? OR o.clientName LIKE ? OR o.clientNumber LIKE ? OR i.itemName LIKE ?
    ORDER BY o.createdAt DESC
  `),
  getStats: db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM orders) as totalOrders,
      (SELECT COUNT(*) FROM items) as totalItems,
      (SELECT COALESCE(SUM(quantity), 0) FROM items) as totalQuantity,
      (SELECT COUNT(DISTINCT clientName) FROM orders) as uniqueClients
  `),
};

// ===== HELPERS =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getOrderWithItems(order) {
  const items = stmts.getItemsByOrderId.all(order.id);
  return { ...order, items };
}

// ===== VALIDATION HELPERS =====
function validateOrder(data) {
  const errors = [];
  if (!data.orderNumber || !data.orderNumber.toString().trim()) errors.push('رقم الأمر مطلوب');
  if (!data.clientName || !data.clientName.toString().trim()) errors.push('اسم العميل مطلوب');
  if (!data.date || !data.date.toString().trim()) errors.push('التاريخ مطلوب');
  return errors;
}

function validateItem(data) {
  const errors = [];
  if (!data.itemName || !data.itemName.toString().trim()) errors.push('اسم الصنف مطلوب');
  if (data.quantity !== undefined && data.quantity !== null && Number(data.quantity) < 0) errors.push('الكمية لا يمكن أن تكون سالبة');
  return errors;
}

// Helper to filter items based on search criteria
function getOrderWithFilteredItems(order, filters, search) {
  let items = stmts.getItemsByOrderId.all(order.id);
  
  if (filters || search) {
    items = items.filter(i => {
      let match = true;
      if (filters?.sizeFilter && filters.sizeFilter.trim()) {
        match = match && i.size && i.size.includes(filters.sizeFilter.trim());
      }
      if (filters?.itemName && filters.itemName.trim()) {
        match = match && i.itemName && i.itemName.includes(filters.itemName.trim());
      }
      if (filters?.dateFilter && filters.dateFilter.trim()) {
        const itemDate = i.createdAt ? i.createdAt.substring(0, 10) : '';
        match = match && (itemDate === filters.dateFilter.trim());
      }
      
      if (search && search.trim() && match) {
        const q = search.trim().toLowerCase();
        const orderMatches = (
          (order.orderNumber && order.orderNumber.toLowerCase().includes(q)) ||
          (order.clientName && order.clientName.toLowerCase().includes(q)) ||
          (order.clientNumber && order.clientNumber.toLowerCase().includes(q))
        );
        if (!orderMatches) {
          match = match && (i.itemName && i.itemName.toLowerCase().includes(q));
        }
      }
      return match;
    });
  }
  return { ...order, items };
}

// ===== JSON AUTO-BACKUP SYSTEM =====
const backupConfigPath = join(dirname(dbPath), 'backup-config.json');
let lastBackupTime = 0;

function getBackupConfig() {
  try {
    if (fs.existsSync(backupConfigPath)) {
      return JSON.parse(fs.readFileSync(backupConfigPath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { backupPath: '' };
}

function setBackupConfig(config) {
  fs.writeFileSync(backupConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

function autoJsonBackup(force = false) {
  const config = getBackupConfig();
  if (!config.backupPath) return;
  
  // Throttle: only backup if 30s passed since last (unless forced)
  const now = Date.now();
  if (!force && (now - lastBackupTime) < 30000) return;
  lastBackupTime = now;
  
  try {
    const backupDir = config.backupPath;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    
    // Export all data
    const orders = stmts.getAllOrders.all().map(getOrderWithItems);
    const jsonData = JSON.stringify(orders, null, 2);
    
    // Save with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup_${timestamp}.json`;
    fs.writeFileSync(join(backupDir, fileName), jsonData, 'utf-8');
    
    // Keep only last 5
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    for (let i = 4; i < backups.length; i++) {
      try { fs.unlinkSync(join(backupDir, backups[i])); } catch { /* ignore */ }
    }
    
    console.log(`📋 JSON backup saved: ${join(backupDir, fileName)}`);
  } catch (err) {
    console.error('Auto JSON backup failed:', err.message);
  }
}

// Auto-backup on startup
autoJsonBackup(true);

// Middleware: auto-backup after every mutation (POST/PUT/DELETE)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400 && !req.path.includes('/backup/')) {
        setImmediate(() => autoJsonBackup());
      }
    });
  }
  next();
});

// ===== BACKUP ENDPOINTS =====

// Get backup settings
app.get('/api/backup/settings', (req, res) => {
  res.json(getBackupConfig());
});

// Set backup path
app.post('/api/backup/settings', (req, res) => {
  try {
    const { backupPath } = req.body;
    if (backupPath && !fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    setBackupConfig({ backupPath: backupPath || '' });
    if (backupPath) autoJsonBackup(true);
    res.json({ success: true, backupPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available backups
app.get('/api/backup/list', (req, res) => {
  try {
    const config = getBackupConfig();
    if (!config.backupPath || !fs.existsSync(config.backupPath)) {
      return res.json([]);
    }
    const files = fs.readdirSync(config.backupPath)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map(f => {
        const stats = fs.statSync(join(config.backupPath, f));
        // Parse date from filename: backup_2026-06-01T15-43-52.json
        const dateStr = f.replace('backup_', '').replace('.json', '');
        const readable = dateStr.replace('T', ' ').replace(/-/g, (m, offset) => offset > 9 ? ':' : '-');
        return {
          name: f,
          date: readable,
          size: (stats.size / 1024).toFixed(1) + ' KB'
        };
      });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore from a specific backup
app.post('/api/backup/restore', (req, res) => {
  try {
    const { fileName } = req.body;
    const config = getBackupConfig();
    if (!config.backupPath) return res.status(400).json({ error: 'لم يتم تحديد مكان النسخ الاحتياطي' });
    
    const filePath = join(config.backupPath, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ملف النسخة غير موجود' });
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) throw new Error('صيغة الملف غير صحيحة');
    
    const importAll = db.transaction(() => {
      db.exec('DELETE FROM items; DELETE FROM orders;');
      for (const order of data) {
        const orderId = order.id || generateId();
        stmts.insertOrder.run(orderId, order.orderNumber, order.clientName, order.clientNumber || '', order.date);
        if (order.items) {
          for (const item of order.items) {
            const itemId = item.id || generateId();
            stmts.insertItem.run(itemId, orderId, item.itemName, item.size || '', item.quantity || 0, item.createdAt || new Date().toISOString());
          }
        }
      }
    });
    
    importAll();
    const result = stmts.getAllOrders.all().map(getOrderWithItems);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROUTES =====

// GET all orders (with advanced search/filter)
app.get('/api/orders', (req, res) => {
  try {
    const { search, dateFilter, orderNumber, clientName, sizeFilter, itemName } = req.query;
    let orders;
    
    // Advanced multi-filter search
    const hasAdvancedFilters = dateFilter || orderNumber || clientName || sizeFilter || itemName;
    const filterObj = { dateFilter, orderNumber, clientName, sizeFilter, itemName };

    if (hasAdvancedFilters) {
      let query = `SELECT DISTINCT o.* FROM orders o LEFT JOIN items i ON o.id = i.orderId WHERE 1=1`;
      const params = [];
      
      if (orderNumber && orderNumber.trim()) {
        query += ` AND o.orderNumber LIKE ?`;
        params.push(`%${orderNumber.trim()}%`);
      }
      if (clientName && clientName.trim()) {
        query += ` AND o.clientName LIKE ?`;
        params.push(`%${clientName.trim()}%`);
      }
      if (itemName && itemName.trim()) {
        query += ` AND i.itemName LIKE ?`;
        params.push(`%${itemName.trim()}%`);
      }
      if (dateFilter && dateFilter.trim()) {
        query += ` AND date(i.createdAt) = ?`;
        params.push(dateFilter.trim());
      }
      if (sizeFilter && sizeFilter.trim()) {
        query += ` AND i.size LIKE ?`;
        params.push(`%${sizeFilter.trim()}%`);
      }
      // Also apply general search if present
      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        query += ` AND (o.orderNumber LIKE ? OR o.clientName LIKE ? OR o.clientNumber LIKE ? OR i.itemName LIKE ?)`;
        params.push(q, q, q, q);
      }
      
      query += ` ORDER BY o.createdAt DESC`;
      orders = db.prepare(query).all(...params);
    } else if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      orders = stmts.searchOrders.all(q, q, q, q);
    } else {
      orders = stmts.getAllOrders.all();
    }
    
    // Filter items inside the matched orders, and filter out orders that end up with 0 items
    // (unless it's an exact orderNumber match and they just want to see the empty order, but typically we hide empty ones)
    let result = orders.map(o => getOrderWithFilteredItems(o, filterObj, search));
    
    // If filtering by item fields, remove orders that have no matching items left
    if (dateFilter || sizeFilter || (search && search.trim())) {
      result = result.filter(o => o.items.length > 0);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = stmts.getOrderById.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(getOrderWithItems(order));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = stmts.getStats.get();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create order (with auto-linking support)
app.post('/api/orders', (req, res) => {
  try {
    const { orderNumber, clientName, clientNumber, date, items, autoLink, matchedOrderId } = req.body;

    const errors = validateOrder({ orderNumber, clientName, date });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('، ') });

    if (items && items.length > 0) {
      for (const item of items) {
        const itemErrors = validateItem(item);
        if (itemErrors.length > 0) return res.status(400).json({ error: itemErrors.join('، ') });
      }
    }

    // Auto-link: If the user wants to add items to an existing order
    if (autoLink && matchedOrderId) {
      const existingOrder = stmts.getOrderById.get(matchedOrderId);
      if (existingOrder) {
        // Add items to the existing order
        const addToExisting = db.transaction(() => {
          if (items && items.length > 0) {
            for (const item of items) {
              const itemId = item.id || generateId();
              stmts.insertItem.run(itemId, matchedOrderId, item.itemName.trim(), (item.size || '').trim(), Math.max(0, item.quantity || 0), item.createdAt || new Date().toISOString());
            }
          }
        });
        addToExisting();
        const order = getOrderWithItems(stmts.getOrderById.get(matchedOrderId));
        return res.status(201).json(order);
      }
    }

    // Normal: create new order
    const orderId = generateId();

    const insertOrderWithItems = db.transaction(() => {
      stmts.insertOrder.run(orderId, orderNumber.trim(), clientName.trim(), (clientNumber || '').trim(), date);
      if (items && items.length > 0) {
        for (const item of items) {
          const itemId = item.id || generateId();
          stmts.insertItem.run(itemId, orderId, item.itemName.trim(), (item.size || '').trim(), Math.max(0, item.quantity || 0), item.createdAt || new Date().toISOString());
        }
      }
    });

    insertOrderWithItems();
    const order = getOrderWithItems(stmts.getOrderById.get(orderId));
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update order (with validation)
app.put('/api/orders/:id', (req, res) => {
  try {
    const { orderNumber, clientName, clientNumber, date, items } = req.body;
    const orderId = req.params.id;

    const errors = validateOrder({ orderNumber, clientName, date });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('، ') });

    const existing = stmts.getOrderById.get(orderId);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    if (items) {
      for (const item of items) {
        const itemErrors = validateItem(item);
        if (itemErrors.length > 0) return res.status(400).json({ error: itemErrors.join('، ') });
      }
    }

    const updateOrderWithItems = db.transaction(() => {
      stmts.updateOrder.run(orderNumber.trim(), clientName.trim(), (clientNumber || '').trim(), date, orderId);
      if (items) {
        stmts.deleteItemsByOrderId.run(orderId);
        for (const item of items) {
          const itemId = item.id || generateId();
          stmts.insertItem.run(itemId, orderId, item.itemName.trim(), (item.size || '').trim(), Math.max(0, item.quantity || 0), item.createdAt || new Date().toISOString());
        }
      }
    });

    updateOrderWithItems();
    const order = getOrderWithItems(stmts.getOrderById.get(orderId));
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE order
app.delete('/api/orders/:id', (req, res) => {
  try {
    const existing = stmts.getOrderById.get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    stmts.deleteOrder.run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add item to order (with validation)
app.post('/api/orders/:id/items', (req, res) => {
  try {
    const orderId = req.params.id;
    const existing = stmts.getOrderById.get(orderId);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const { itemName, size, quantity } = req.body;

    const errors = validateItem({ itemName, quantity });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('، ') });

    const itemId = generateId();
    stmts.insertItem.run(itemId, orderId, itemName.trim(), (size || '').trim(), Math.max(0, quantity || 0), new Date().toISOString());

    const order = getOrderWithItems(stmts.getOrderById.get(orderId));
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update item (with validation)
app.put('/api/orders/:orderId/items/:itemId', (req, res) => {
  try {
    const { itemName, size, quantity } = req.body;

    const errors = validateItem({ itemName, quantity });
    if (errors.length > 0) return res.status(400).json({ error: errors.join('، ') });

    stmts.updateItem.run(itemName.trim(), (size || '').trim(), Math.max(0, quantity || 0), req.params.itemId);

    const order = getOrderWithItems(stmts.getOrderById.get(req.params.orderId));
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE item
app.delete('/api/orders/:orderId/items/:itemId', (req, res) => {
  try {
    stmts.deleteItem.run(req.params.itemId);
    const order = getOrderWithItems(stmts.getOrderById.get(req.params.orderId));
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST import data (PROTECTED: auto-backup before deleting old data)
app.post('/api/import', (req, res) => {
  try {
    const orders = req.body;
    if (!Array.isArray(orders)) return res.status(400).json({ error: 'صيغة الملف غير صحيحة' });
    if (orders.length === 0) return res.status(400).json({ error: 'الملف فارغ - لا توجد بيانات للاستيراد' });

    // Validate imported data structure
    for (const order of orders) {
      if (!order.orderNumber || !order.clientName || !order.date) {
        return res.status(400).json({ error: 'الملف يحتوي على بيانات ناقصة أو غير صحيحة' });
      }
    }

    // Auto-backup before import (safety net)
    try {
      const backupDir = join(dirname(dbPath), 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = join(backupDir, `pre_import_${timestamp}.db`);
      db.backup(backupPath).catch(() => {});
    } catch { /* non-critical */ }

    const importAll = db.transaction(() => {
      db.exec('DELETE FROM items; DELETE FROM orders;');
      for (const order of orders) {
        const orderId = order.id || generateId();
        stmts.insertOrder.run(orderId, order.orderNumber, order.clientName, order.clientNumber || '', order.date);
        if (order.items) {
          for (const item of order.items) {
            const itemId = item.id || generateId();
            stmts.insertItem.run(itemId, orderId, item.itemName, item.size || '', item.quantity || 0, item.createdAt || new Date().toISOString());
          }
        }
      }
    });

    importAll();
    const result = stmts.getAllOrders.all().map(getOrderWithItems);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET export data
app.get('/api/export', (req, res) => {
  try {
    const orders = stmts.getAllOrders.all().map(getOrderWithItems);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

      // ===== SERVE STATIC FRONTEND =====
      app.use(express.static(join(currentDir, '../dist'), {
        maxAge: '1h',
        etag: true,
        lastModified: true
      }));

      app.use((req, res, next) => {
        if (req.method === 'GET') {
          res.sendFile(join(currentDir, '../dist/index.html'));
        } else {
          next();
        }
      });

      // ===== START SERVER =====
      const server = app.listen(port, () => {
        const actualPort = server.address().port;
        console.log(`✅ Server running on http://localhost:${actualPort}`);
        console.log(`📁 Database: ${dbPath}`);
        resolve({ port: actualPort, db, server });
      });
      
      server.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Run directly if not imported (Only during dev, not inside Electron ASAR)
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const defaultDbPath = join(currentDir, 'database.db');
  const port = process.env.PORT || 3001;
  startServer(defaultDbPath, port).catch(console.error);
}
