import { useEffect } from 'react';

/**
 * Convert Western numerals (0-9) to Arabic-Hindi numerals (٠-٩)
 */
function toArabicNumerals(value) {
  if (value === null || value === undefined) return '—';
  const str = String(value);
  return str.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

/**
 * Format a date string to Arabic numerals date
 */
function formatDateArabic(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return toArabicNumerals(`${year}-${month}-${day}`);
  } catch {
    return toArabicNumerals(dateStr);
  }
}

/**
 * PrintView component
 * 
 * Props:
 *   - order: single order (used for single-order print)
 *   - orders: array of orders (used for multi-order print)
 *   - singleItem: if provided, prints only this item from the order
 *   - onClose: callback to close print view
 */
function PrintView({ order, orders, singleItem, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  const today = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeNow = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Determine mode: multi-order, single-order, or single-item
  const isMultiOrder = orders && orders.length > 0;
  const isSingleItem = !isMultiOrder && singleItem;

  return (
    <div className="print-overlay">
      <div className="print-page">
        {/* Screen-only buttons */}
        <div className="print-no-print" style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            🖨️ طباعة
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            ✕ إغلاق
          </button>
        </div>

        <div className="print-sheet">
          {isMultiOrder ? (
            /* ===== MULTI-ORDER PRINT (Worker's daily sheet) ===== */
            <MultiOrderView orders={orders} today={today} timeNow={timeNow} />
          ) : (
            /* ===== SINGLE ORDER / SINGLE ITEM PRINT ===== */
            <SingleOrderView order={order} singleItem={singleItem} isSingleItem={isSingleItem} today={today} timeNow={timeNow} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-order view: All orders in one table for daily worker sheet
 * UPDATED: اسم الصنف أولاً + إضافة اسم العميل
 */
function MultiOrderView({ orders, today, timeNow }) {
  // Flatten all items from all orders into a single list
  const allRows = [];
  let rowCounter = 0;
  orders.forEach((order) => {
    order.items.forEach((item) => {
      rowCounter++;
      allRows.push({
        rowNum: rowCounter,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        itemName: item.itemName,
        size: item.size || '—',
        quantity: item.quantity || 0,
        date: order.date || item.createdAt,
      });
    });
  });

  const totalQty = allRows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <table className="print-main-table">
      <tbody>
        {/* Report date */}
        <tr>
          <td colSpan="7" className="print-date-row">
            تاريخ التقرير: {toArabicNumerals(new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' }))}
          </td>
        </tr>

        {/* Title row */}
        <tr>
          <td colSpan="7" className="print-title-row">
            أوامر وطلبات اليوم
          </td>
        </tr>

        {/* Table header - اسم الصنف أولاً + اسم العميل */}
        <tr className="print-items-header">
          <td className="print-items-th" style={{ width: '45px' }}>م</td>
          <td className="print-items-th">اسم الصنف</td>
          <td className="print-items-th" style={{ width: '90px' }}>اسم العميل</td>
          <td className="print-items-th" style={{ width: '75px' }}>رقم الأمر</td>
          <td className="print-items-th" style={{ width: '90px' }}>المقاس</td>
          <td className="print-items-th" style={{ width: '55px' }}>الكمية</td>
          <td className="print-items-th" style={{ width: '100px' }}>التاريخ</td>
        </tr>

        {/* Data rows */}
        {allRows.map((row, index) => (
          <tr key={`${row.orderNumber}-${index}`} className={index % 2 === 0 ? 'print-items-row-even' : 'print-items-row-odd'}>
            <td className="print-items-td print-items-td-num">{toArabicNumerals(row.rowNum)}</td>
            <td className="print-items-td" style={{ fontWeight: 600 }}>{toArabicNumerals(row.itemName)}</td>
            <td className="print-items-td" style={{ fontSize: '0.82rem' }}>{row.clientName || '—'}</td>
            <td className="print-items-td" style={{ fontWeight: 700 }}>{toArabicNumerals(row.orderNumber)}</td>
            <td className="print-items-td">
              <span dir="ltr" style={{ display: 'inline-block' }}>
                {row.size ? toArabicNumerals(row.size) : '—'}
              </span>
            </td>
            <td className="print-items-td print-items-td-qty">{toArabicNumerals(row.quantity)}</td>
            <td className="print-items-td" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {formatDateArabic(row.date)}
            </td>
          </tr>
        ))}

        {/* Total row */}
        <tr className="print-total-row">
          <td colSpan="5" className="print-total-label">إجمالي الكمية</td>
          <td className="print-total-value">{toArabicNumerals(totalQty)}</td>
          <td className="print-total-label" style={{ borderRight: 'none' }}></td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Single order / single item view (existing behavior with Arabic numerals)
 * UPDATED: اسم الصنف أولاً + إضافة اسم العميل
 */
function SingleOrderView({ order, singleItem, isSingleItem, today, timeNow }) {
  const items = isSingleItem ? [singleItem] : order.items;
  const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <table className="print-main-table">
      <tbody>
        {/* Row 1: Print date */}
        <tr>
          <td colSpan="5" className="print-date-row">
            <span>تاريخ الطباعة: {today} — {timeNow}</span>
          </td>
        </tr>

        {/* Row 2: Title */}
        <tr>
          <td colSpan="5" className="print-title-row">
            {isSingleItem ? 'تفاصيل طلب' : 'تفاصيل أمر'}
          </td>
        </tr>

        {/* Row 3-4: Order info - إضافة اسم العميل أولاً */}
        <tr className="print-info-row">
          <td className="print-info-label-cell">اسم العميل</td>
          <td className="print-info-value-cell">{order.clientName}</td>
          <td className="print-info-label-cell">رقم الأمر</td>
          <td className="print-info-value-cell" colSpan="2">{toArabicNumerals(order.orderNumber)}</td>
        </tr>
        <tr className="print-info-row">
          <td className="print-info-label-cell">التاريخ</td>
          <td className="print-info-value-cell">{formatDateArabic(order.date)}</td>
          <td className="print-info-label-cell">رقم العميل</td>
          <td className="print-info-value-cell" colSpan="2">{order.clientNumber ? toArabicNumerals(order.clientNumber) : '—'}</td>
        </tr>

        {/* Spacer */}
        <tr>
          <td colSpan="5" style={{ height: '12px', border: 'none' }}></td>
        </tr>

        {/* Items header - اسم الصنف أولاً */}
        <tr className="print-items-header">
          <td className="print-items-th" style={{ width: '50px' }}>م</td>
          <td className="print-items-th">اسم الصنف</td>
          <td className="print-items-th">تاريخ الطلب</td>
          <td className="print-items-th">المقاس</td>
          <td className="print-items-th">الكمية</td>
        </tr>

        {/* Items rows - اسم الصنف أولاً */}
        {items.map((item, index) => (
          <tr key={item.id} className={index % 2 === 0 ? 'print-items-row-even' : 'print-items-row-odd'}>
            <td className="print-items-td print-items-td-num">{toArabicNumerals(index + 1)}</td>
            <td className="print-items-td" style={{ fontWeight: 600 }}>{toArabicNumerals(item.itemName)}</td>
            <td className="print-items-td" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {item.createdAt ? formatDateArabic(item.createdAt) : '—'}
            </td>
            <td className="print-items-td">
              <span dir="ltr" style={{ display: 'inline-block' }}>
                {item.size ? toArabicNumerals(item.size) : '—'}
              </span>
            </td>
            <td className="print-items-td print-items-td-qty">{toArabicNumerals(item.quantity)}</td>
          </tr>
        ))}

        {/* Total row */}
        <tr className="print-total-row">
          <td colSpan="4" className="print-total-label">إجمالي الكمية</td>
          <td className="print-total-value">{toArabicNumerals(totalQty)}</td>

        </tr>
      </tbody>
    </table>
  );
}

export default PrintView;
