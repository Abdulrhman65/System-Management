import { useState } from 'react';
import { FiChevronDown, FiEdit2, FiTrash2, FiPlus, FiCalendar, FiUser, FiHash } from 'react-icons/fi';

function OrderCard({ order, selectedItems, onToggleOrder, onToggleItem, onEditOrder, onAddItem, onEditItem, onDeleteItem, onDeleteOrder }) {
  const [isOpen, setIsOpen] = useState(false);

  const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const selectedItemsCount = order.items.filter(item => selectedItems.has(item.id)).length;
  const isAllSelected = selectedItemsCount === order.items.length && order.items.length > 0;
  const isIndeterminate = selectedItemsCount > 0 && selectedItemsCount < order.items.length;
  return (
    <div className={`order-card ${selectedItemsCount > 0 ? 'selected' : ''}`}>
      <div className="order-card-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="order-info" style={{ display: 'flex', alignItems: 'center' }}>
          <div 
            className="checkbox-wrapper" 
            onClick={(e) => { e.stopPropagation(); onToggleOrder(order); }}
            style={{ marginRight: '12px', cursor: 'pointer' }}
          >
            <input 
              type="checkbox" 
              checked={isAllSelected}
              ref={el => { if (el) el.indeterminate = isIndeterminate; }}
              onChange={() => {}} /* Handled by wrapper click */
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
            />
          </div>
          <span className="order-number-badge">
            <FiHash style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
            {order.orderNumber}
          </span>
          <div className="order-client-info">
            <span className="order-client-name">
              <FiUser style={{ marginLeft: '6px', fontSize: '0.85rem', opacity: 0.6, verticalAlign: 'middle' }} />
              {order.clientName}
            </span>
            {order.clientNumber && (
              <span className="order-client-number">رقم العميل: {order.clientNumber}</span>
            )}
          </div>
        </div>
        <div className="order-meta">
          <span className="order-date">
            <FiCalendar style={{ fontSize: '0.85rem' }} />
            {order.date}
          </span>
          <span className="order-items-count">
            {order.items.length} طلب • {totalQuantity} قطعة
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-icon btn-sm btn-secondary"
              onClick={(e) => { e.stopPropagation(); onEditOrder(order); }}
              title="تعديل الأمر"
            >
              <FiEdit2 />
            </button>
            <button
              className="btn btn-icon btn-sm btn-danger"
              onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}
              title="حذف الأمر"
            >
              <FiTrash2 />
            </button>
          </div>
          <span className={`order-toggle ${isOpen ? 'open' : ''}`}>
            <FiChevronDown />
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="order-card-body">
          <div className="order-card-body-inner">
            {order.items.length > 0 ? (
              <div className="items-table-wrapper">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>#</th>
                      <th>اسم الصنف</th>
                      <th>تاريخ الطلب</th>
                      <th>المقاس</th>
                      <th>الكمية</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => {
                        const isItemSelected = selectedItems.has(item.id);
                        return (
                      <tr key={item.id} className={isItemSelected ? 'item-selected' : ''}>
                        <td>
                          <input 
                            type="checkbox"
                            checked={isItemSelected}
                            onChange={() => onToggleItem(item.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                          />
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{index + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.itemName}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-EG') : '—'}
                        </td>
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
                          <div className="item-actions">
                            <button
                              className="btn btn-icon btn-sm btn-secondary"
                              onClick={() => onEditItem(order.id, item)}
                              title="تعديل الطلب"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              className="btn btn-icon btn-sm btn-danger"
                              onClick={() => onDeleteItem(order.id, item.id)}
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
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                لا توجد طلبات في هذا الأمر
              </div>
            )}
            <div className="add-item-row">
              <button className="btn btn-sm btn-success" onClick={() => onAddItem(order.id)}>
                <FiPlus /> إضافة طلب جديد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderCard;
