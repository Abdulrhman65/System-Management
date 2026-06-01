const API_BASE = '/api';

export async function loadOrders(search = '', filters = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (filters.dateFilter) params.set('dateFilter', filters.dateFilter);
  if (filters.orderNumber) params.set('orderNumber', filters.orderNumber);
  if (filters.clientName) params.set('clientName', filters.clientName);
  if (filters.sizeFilter) params.set('sizeFilter', filters.sizeFilter);
  if (filters.itemName) params.set('itemName', filters.itemName);
  
  const queryString = params.toString();
  const url = queryString ? `${API_BASE}/orders?${queryString}` : `${API_BASE}/orders`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json();
}

export async function loadStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export async function getOrder(id) {
  const res = await fetch(`${API_BASE}/orders/${id}`);
  if (!res.ok) throw new Error('Failed to load order');
  return res.json();
}

export async function createOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) throw new Error('Failed to create order');
  return res.json();
}

export async function updateOrder(id, orderData) {
  const res = await fetch(`${API_BASE}/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) throw new Error('Failed to update order');
  return res.json();
}

export async function deleteOrder(id) {
  const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete order');
  return res.json();
}

export async function addItem(orderId, itemData) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
  if (!res.ok) throw new Error('Failed to add item');
  return res.json();
}

export async function updateItem(orderId, itemId, itemData) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
  if (!res.ok) throw new Error('Failed to update item');
  return res.json();
}

export async function deleteItem(orderId, itemId) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete item');
  return res.json();
}

export async function exportData() {
  const res = await fetch(`${API_BASE}/export`);
  if (!res.ok) throw new Error('Failed to export');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orders_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return data;
}

export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid format');
        const res = await fetch(`${API_BASE}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Import failed');
        const result = await res.json();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ===== BACKUP MANAGEMENT =====
export async function getBackupSettings() {
  const res = await fetch(`${API_BASE}/backup/settings`);
  if (!res.ok) throw new Error('Failed to load backup settings');
  return res.json();
}

export async function setBackupPath(backupPath) {
  const res = await fetch(`${API_BASE}/backup/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupPath }),
  });
  if (!res.ok) throw new Error('Failed to save backup settings');
  return res.json();
}

export async function listBackups() {
  const res = await fetch(`${API_BASE}/backup/list`);
  if (!res.ok) throw new Error('Failed to list backups');
  return res.json();
}

export async function restoreBackup(fileName) {
  const res = await fetch(`${API_BASE}/backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName }),
  });
  if (!res.ok) throw new Error('Failed to restore backup');
  return res.json();
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
