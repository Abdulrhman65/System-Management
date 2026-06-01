import { useState } from 'react';
import { FiX } from 'react-icons/fi';

function ItemModal({ item, onSave, onClose }) {
  const defaultDate = new Date().toISOString().split('T')[0];
  const initialHeight = item && item.size && item.size.includes(' x ') ? item.size.split(' x ')[0] : '';
  const initialWidth = item && item.size ? (item.size.includes(' x ') ? item.size.split(' x ')[1] : item.size) : '';
  
  const [formData, setFormData] = useState({
    itemName: item ? item.itemName : '',
    sizeWidth: initialWidth,
    sizeHeight: initialHeight,
    quantity: item ? item.quantity : '',
    createdAt: item && item.createdAt ? item.createdAt.split('T')[0] : defaultDate
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.itemName.trim() || !formData.sizeWidth.trim()) return;

    const size = formData.sizeHeight.trim() 
      ? `${formData.sizeHeight.trim()} x ${formData.sizeWidth.trim()}` 
      : formData.sizeWidth.trim();

    onSave({
      id: item ? item.id : undefined,
      itemName: formData.itemName.trim(),
      size: size,
      quantity: Number(formData.quantity) || 0,
      createdAt: formData.createdAt ? new Date(formData.createdAt).toISOString() : new Date().toISOString()
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {item ? 'تعديل الطلب' : 'إضافة طلب جديد'}
          </h2>
          <button type="button" className="btn btn-icon btn-secondary" onClick={onClose}>
            <FiX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">اسم الصنف *</label>
                <input
                  type="text"
                  name="itemName"
                  className="form-input"
                  value={formData.itemName}
                  onChange={handleChange}
                  placeholder="اسم الصنف"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">تاريخ إضافة الطلب</label>
                <input
                  type="date"
                  name="createdAt"
                  className="form-input"
                  value={formData.createdAt}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">العرض *</label>
                <input
                  type="text"
                  name="sizeWidth"
                  className="form-input"
                  value={formData.sizeWidth}
                  onChange={handleChange}
                  placeholder="العرض"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">الطول (اختياري)</label>
                <input
                  type="text"
                  name="sizeHeight"
                  className="form-input"
                  value={formData.sizeHeight}
                  onChange={handleChange}
                  placeholder="الطول"
                />
              </div>
              <div className="form-group">
                <label className="form-label">الكمية</label>
                <input
                  type="number"
                  name="quantity"
                  className="form-input"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="الكمية"
                  min="0"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary">
              {item ? 'حفظ التعديلات' : 'إضافة الطلب'}
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

export default ItemModal;
