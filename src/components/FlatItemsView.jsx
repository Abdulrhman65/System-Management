import { FiEdit2, FiTrash2, FiHash, FiUser, FiCalendar } from 'react-icons/fi';

function FlatItemsView({ orders, selectedItems, onToggleItem, onEditItem, onDeleteItem }) {
  // Flatten orders into items
  const allItems = orders.flatMap(order => 
    order.items.map(item => ({
      ...item,
      orderId: order.id,
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      clientNumber: order.clientNumber,
      orderDate: order.date
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort newest to oldest

  if (allItems.length === 0) {
    return null; // Handled by App.jsx empty state
  }

  return (
    <div className="flat-items-container">
      <div className="items-table-wrapper" style={{ margin: 0, border: '1px solid var(--border-subtle)' }}>
        <table className="items-table flat-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>رقم الأمر</th>
              <th>اسم العميل</th>
              <th>اسم الصنف</th>
              <th>المقاس</th>
              <th>الكمية</th>
              <th>تاريخ الطلب</th>
              <th style={{ width: '100px' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item) => {
              const isSelected = selectedItems.has(item.id);
              return (
                <tr key={item.id} className={isSelected ? 'item-selected' : ''} onClick={() => onToggleItem(item.id)} style={{ cursor: 'pointer' }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleItem(item.id)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                    />
                  </td>
                  <td>
                    <span className="order-number-badge" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                      <FiHash style={{ marginLeft: '4px', verticalAlign: 'middle', fontSize: '0.7rem' }} />
                      {item.orderNumber}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.clientName}
                    </div>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--accent-tertiary)' }}>{item.itemName}</td>
                  <td>
                    <span dir="ltr" style={{ display: 'inline-block' }}>
                      {item.size || '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: 'var(--accent-glow)',
                      color: 'var(--accent-tertiary)',
                      padding: '2px 10px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}>
                      {item.quantity}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <FiCalendar />
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : '—'}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="item-actions">
                      <button
                        className="btn btn-icon btn-sm btn-secondary"
                        onClick={() => onEditItem(item.orderId, item)}
                        title="تعديل الطلب"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        className="btn btn-icon btn-sm btn-danger"
                        onClick={() => onDeleteItem(item.orderId, item.id)}
                        title="حذف الطلب"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FlatItemsView;
