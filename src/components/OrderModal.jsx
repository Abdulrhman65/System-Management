import { useState, useEffect, useRef } from 'react';
import { FiX, FiLink, FiPlus, FiInfo } from 'react-icons/fi';
import { generateId } from '../utils/storage';

function getInitialFormData(order) {
  const defaultDate = new Date().toISOString().split('T')[0];
  if (order) {
    return {
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      clientNumber: order.clientNumber,
      date: order.date,
      items: order.items.length > 0 ? order.items.map(item => ({
        ...item,
        sizeHeight: item.size && item.size.includes(' x ') ? item.size.split(' x ')[0] : '',
        sizeWidth: item.size ? (item.size.includes(' x ') ? item.size.split(' x ')[1] : item.size) : '',
        createdAt: item.createdAt ? item.createdAt.split('T')[0] : defaultDate
      })) : [{ id: generateId(), itemName: '', sizeWidth: '', sizeHeight: '', quantity: '', createdAt: defaultDate }]
    };
  }
  return {
    orderNumber: '',
    clientName: '',
    clientNumber: '',
    date: defaultDate,
    items: [{ id: generateId(), itemName: '', sizeWidth: '', sizeHeight: '', quantity: '', createdAt: defaultDate }]
  };
}

function OrderModal({ order, onSave, onClose, existingOrders = [] }) {
  const [formData, setFormData] = useState(() => getInitialFormData(order));
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const suggestionsRef = useRef(null);
  const orderNumberRef = useRef(null);

  // Check if the entered order number matches an existing order
  useEffect(() => {
    if (order) return; // Don't check when editing
    const trimmed = formData.orderNumber.trim();
    if (trimmed) {
      const match = existingOrders.find(o => o.orderNumber.trim() === trimmed);
      setMatchedOrder(match || null);
      // Auto-fill client info if matched
      if (match && !formData.clientName.trim()) {
        setFormData(prev => ({
          ...prev,
          clientName: match.clientName,
          clientNumber: match.clientNumber || '',
          date: match.date
        }));
      }
    } else {
      setMatchedOrder(null);
    }
  }, [formData.orderNumber, existingOrders, order]);

  // Filter suggestions as user types
  useEffect(() => {
    if (order) return;
    const trimmed = formData.orderNumber.trim();
    if (trimmed.length > 0) {
      const filtered = existingOrders
        .filter(o => o.orderNumber.includes(trimmed))
        .reduce((acc, o) => {
          // De-duplicate by orderNumber
          if (!acc.find(x => x.orderNumber === o.orderNumber)) acc.push(o);
          return acc;
        }, [])
        .slice(0, 8);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [formData.orderNumber, existingOrders, order]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          orderNumberRef.current && !orderNumberRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (itemId, field, value) => {
    setFormData({
      ...formData,
      items: formData.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    });
  };

  const addItem = () => {
    const defaultDate = new Date().toISOString().split('T')[0];
    setFormData({
      ...formData,
      items: [...formData.items, { id: generateId(), itemName: '', sizeWidth: '', sizeHeight: '', quantity: '', createdAt: defaultDate }]
    });
  };

  const removeItem = (itemId) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== itemId)
    });
  };

  const selectSuggestion = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      orderNumber: suggestion.orderNumber,
      clientName: suggestion.clientName,
      clientNumber: suggestion.clientNumber || '',
      date: suggestion.date
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.orderNumber.trim() || !formData.clientName.trim()) {
      return;
    }

    const validItems = formData.items.filter(
      (item) => item.itemName.trim() && item.sizeWidth.trim()
    );

    if (validItems.length === 0) {
      return;
    }

    const orderData = {
      id: order ? order.id : generateId(),
      orderNumber: formData.orderNumber.trim(),
      clientName: formData.clientName.trim(),
      clientNumber: formData.clientNumber.trim(),
      date: formData.date,
      // Flag to tell the backend about auto-linking
      autoLink: !order && !!matchedOrder,
      matchedOrderId: matchedOrder?.id || null,
      items: validItems.map((item) => {
        const size = item.sizeHeight.trim() ? `${item.sizeHeight.trim()} x ${item.sizeWidth.trim()}` : item.sizeWidth.trim();
        return {
          id: item.id,
          itemName: item.itemName.trim(),
          size: size,
          quantity: Number(item.quantity) || 0,
          createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()
        };
      })
    };

    onSave(orderData);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {order ? 'تعديل الأمر' : 'تسجيل أمر / طلب'}
          </h2>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Auto-link notice */}
            {!order && matchedOrder && (
              <div className="auto-link-notice">
                <FiLink className="auto-link-icon" />
                <div className="auto-link-text">
                  <strong>سيتم ربط الطلبات تلقائياً</strong> بالأمر الموجود رقم "{matchedOrder.orderNumber}" — العميل: {matchedOrder.clientName}
                </div>
              </div>
            )}

            {!order && !matchedOrder && formData.orderNumber.trim() && (
              <div className="auto-link-notice new-order-notice">
                <FiInfo className="auto-link-icon" />
                <div className="auto-link-text">
                  سيتم إنشاء <strong>أمر جديد</strong> برقم "{formData.orderNumber.trim()}"
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">رقم الأمر *</label>
                <input
                  ref={orderNumberRef}
                  type="text"
                  name="orderNumber"
                  className="form-input"
                  value={formData.orderNumber}
                  onChange={handleChange}
                  onFocus={() => !order && setShowSuggestions(true)}
                  required
                  autoFocus
                  autoComplete="off"
                  placeholder="اكتب رقم الأمر (جديد أو موجود)"
                />
                {/* Suggestions dropdown */}
                {showSuggestions && filteredSuggestions.length > 0 && !order && (
                  <div className="order-suggestions" ref={suggestionsRef}>
                    <div className="suggestions-header">
                      <FiLink style={{ fontSize: '0.8rem' }} />
                      أوامر موجودة مشابهة
                    </div>
                    {filteredSuggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className={`suggestion-item ${s.orderNumber === formData.orderNumber.trim() ? 'active' : ''}`}
                        onClick={() => selectSuggestion(s)}
                      >
                        <span className="suggestion-order-num">{s.orderNumber}</span>
                        <span className="suggestion-client">{s.clientName}</span>
                        <span className="suggestion-date">{s.date}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">التاريخ *</label>
                <input
                  type="date"
                  name="date"
                  className="form-input"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">اسم العميل *</label>
                <input
                  type="text"
                  name="clientName"
                  className="form-input"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="اسم العميل"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">رقم العميل</label>
                <input
                  type="text"
                  name="clientNumber"
                  className="form-input"
                  value={formData.clientNumber}
                  onChange={handleChange}
                  placeholder="رقم العميل"
                />
              </div>
            </div>

            <div style={{ marginTop: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label className="form-label" style={{ margin: 0 }}>الطلبات</label>
                <button type="button" className="btn btn-sm btn-success" onClick={addItem}>
                  + إضافة طلب
                </button>
              </div>

              {formData.items.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    marginBottom: '12px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                      طلب #{index + 1}
                    </span>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-danger"
                        onClick={() => removeItem(item.id)}
                        style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                  
                  <div className="form-row" style={{ marginBottom: '14px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">اسم الصنف *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={item.itemName}
                        onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                        placeholder="اسم الصنف"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">تاريخ إضافة الطلب</label>
                      <input
                        type="date"
                        className="form-input"
                        value={item.createdAt}
                        onChange={(e) => handleItemChange(item.id, 'createdAt', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">العرض *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={item.sizeWidth}
                        onChange={(e) => handleItemChange(item.id, 'sizeWidth', e.target.value)}
                        placeholder="العرض"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">الطول (اختياري)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={item.sizeHeight}
                        onChange={(e) => handleItemChange(item.id, 'sizeHeight', e.target.value)}
                        placeholder="الطول"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">الكمية</label>
                      <input
                        type="number"
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        placeholder="الكمية"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              {order ? 'حفظ التعديلات' : (matchedOrder ? 'إضافة الطلبات للأمر الموجود' : 'إضافة الأمر')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OrderModal;
