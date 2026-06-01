import { useState, useEffect, useCallback, useRef } from 'react';
import { FiPlus, FiSearch, FiDownload, FiUpload, FiPackage, FiUsers, FiLayers, FiBox, FiShield, FiChevronDown, FiAlertTriangle, FiPrinter, FiFilter, FiX, FiList, FiArchive, FiSun, FiMoon, FiPhone, FiCode, FiFolder, FiClock, FiRefreshCw } from 'react-icons/fi';
import { FaFacebookF, FaLinkedinIn } from 'react-icons/fa';
import * as api from './utils/storage';
import OrderCard from './components/OrderCard';
import FlatItemsView from './components/FlatItemsView';
import OrderModal from './components/OrderModal';
import ItemModal from './components/ItemModal';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import PrintView from './components/PrintView';

function App() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalItems: 0, totalQuantity: 0, uniqueClients: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [printData, setPrintData] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('flat'); // 'flat' | 'archive'
  const [backupPath, setBackupPath] = useState('');
  const [backupList, setBackupList] = useState([]);
  const [showRestoreList, setShowRestoreList] = useState(false);
  
  // Theme context
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'dark';
  });

  const [filters, setFilters] = useState({
    dateFilter: '',
    orderNumber: '',
    clientName: '',
    sizeFilter: '',
    itemName: ''
  });
  const fileInputRef = useRef(null);
  const searchTimerRef = useRef(null);
  const backupMenuRef = useRef(null);

  // Sync theme with document & localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const addToast = useCallback((message, type = 'success') => {
    const id = api.generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const hasActiveFilters = filters.dateFilter || filters.orderNumber || filters.clientName || filters.sizeFilter || filters.itemName;

  const refreshData = async (search = '', currentFilters = filters) => {
    try {
      const [ordersData, statsData] = await Promise.all([
        api.loadOrders(search, currentFilters),
        api.loadStats()
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch {
      // silently fail on refresh
    }
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        const [ordersData, statsData] = await Promise.all([
          api.loadOrders(),
          api.loadStats()
        ]);
        setOrders(ordersData);
        setStats(statsData);
        // Load backup settings
        try {
          const backupSettings = await api.getBackupSettings();
          setBackupPath(backupSettings.backupPath || '');
        } catch { /* non-critical */ }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await api.loadOrders(searchQuery, filters);
        setOrders(data);
      } catch {
        // silently fail
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, filters]);

  // Close backup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (backupMenuRef.current && !backupMenuRef.current.contains(e.target)) {
        setShowBackupMenu(false);
      }
    };
    if (showBackupMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBackupMenu]);

  // Order CRUD
  const handleSaveOrder = async (orderData) => {
    try {
      if (editingOrder) {
        await api.updateOrder(editingOrder.id, orderData);
        addToast('تم تعديل الأمر بنجاح');
      } else {
        await api.createOrder(orderData);
        if (orderData.autoLink && orderData.matchedOrderId) {
          addToast('تم إضافة الطلبات للأمر الموجود بنجاح ✨');
        } else {
          addToast('تم إضافة الأمر بنجاح');
        }
      }
      setShowOrderModal(false);
      setEditingOrder(null);
      refreshData(searchQuery, filters);
    } catch (err) {
      addToast(err.message || 'حدث خطأ', 'error');
    }
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setShowOrderModal(true);
  };

  const handleDeleteOrder = (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    setConfirmDialog({
      message: `هل تريد حذف الأمر رقم ${order?.orderNumber}؟`,
      subMessage: 'سيتم حذف جميع الطلبات المرتبطة بهذا الأمر',
      onConfirm: async () => {
        try {
          await api.deleteOrder(orderId);
          setConfirmDialog(null);
          addToast('تم حذف الأمر بنجاح');
          refreshData(searchQuery, filters);
        } catch {
          addToast('فشل في حذف الأمر', 'error');
        }
      }
    });
  };

  // Item CRUD
  const handleAddItem = (orderId) => {
    setActiveOrderId(orderId);
    setEditingItem(null);
    setShowItemModal(true);
  };

  const handleEditItem = (orderId, item) => {
    setActiveOrderId(orderId);
    setEditingItem(item);
    setShowItemModal(true);
  };

  const handleSaveItem = async (itemData) => {
    try {
      if (editingItem) {
        await api.updateItem(activeOrderId, editingItem.id, itemData);
        addToast('تم تعديل الطلب بنجاح');
      } else {
        await api.addItem(activeOrderId, itemData);
        addToast('تم إضافة الطلب بنجاح');
      }
      setShowItemModal(false);
      setEditingItem(null);
      setActiveOrderId(null);
      refreshData(searchQuery, filters);
    } catch (err) {
      addToast(err.message || 'حدث خطأ', 'error');
    }
  };

  const handleDeleteItem = (orderId, itemId) => {
    const order = orders.find((o) => o.id === orderId);
    const item = order?.items.find((i) => i.id === itemId);

    setConfirmDialog({
      message: `هل تريد حذف الطلب "${item?.itemName}"؟`,
      subMessage: 'لن يتم حذف الأمر نفسه، فقط هذا الطلب',
      onConfirm: async () => {
        try {
          await api.deleteItem(orderId, itemId);
          setConfirmDialog(null);
          addToast('تم حذف الطلب بنجاح');
          refreshData(searchQuery, filters);
        } catch {
          addToast('فشل في حذف الطلب', 'error');
        }
      }
    });
  };

  // Selection & Print
  const handleToggleItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const handleToggleOrder = (order) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      const allSelected = order.items.every(item => newSet.has(item.id));
      if (allSelected) {
        order.items.forEach(item => newSet.delete(item.id));
      } else {
        order.items.forEach(item => newSet.add(item.id));
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const newSet = new Set(selectedItems);
    orders.forEach(order => {
      order.items.forEach(item => {
        newSet.add(item.id);
      });
    });
    setSelectedItems(newSet);
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handlePrintSelected = () => {
    if (selectedItems.size === 0) {
      addToast('رجاءً قم بتحديد الأوامر أو الطلبات المراد طباعتها أولاً', 'error');
      return;
    }

    const filteredOrders = orders.map(order => ({
      ...order,
      items: order.items.filter(item => selectedItems.has(item.id))
    })).filter(order => order.items.length > 0);

    setPrintData({ order: null, orders: filteredOrders, singleItem: null });
  };

  // Filter handlers
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ dateFilter: '', orderNumber: '', clientName: '', sizeFilter: '', itemName: '' });
  };

  // ===== BACKUP OPERATIONS =====
  const handleExport = async () => {
    setShowBackupMenu(false);
    if (orders.length === 0) {
      addToast('لا توجد بيانات للتصدير', 'error');
      return;
    }
    try {
      await api.exportData();
      addToast('تم حفظ النسخة الاحتياطية بنجاح', 'info');
    } catch {
      addToast('فشل في حفظ النسخة الاحتياطية', 'error');
    }
  };

  // ===== AUTO-BACKUP MANAGEMENT =====
  const handleSelectBackupFolder = async () => {
    try {
      let selectedPath = null;
      // Use Electron dialog if available
      if (window.electronAPI?.selectFolder) {
        selectedPath = await window.electronAPI.selectFolder();
      } else {
        selectedPath = prompt('أدخل مسار مجلد النسخ الاحتياطي (مثال: D:\\Backups)');
      }
      if (!selectedPath) return;
      
      await api.setBackupPath(selectedPath);
      setBackupPath(selectedPath);
      addToast(`تم تفعيل النسخ الاحتياطي التلقائي: ${selectedPath}`);
    } catch {
      addToast('فشل في حفظ إعدادات النسخ الاحتياطي', 'error');
    }
  };

  const handleLoadBackupList = async () => {
    try {
      const list = await api.listBackups();
      setBackupList(list);
      setShowRestoreList(true);
      setShowBackupMenu(false);
    } catch {
      addToast('فشل في تحميل قائمة النسخ', 'error');
    }
  };

  const handleRestoreBackup = async (fileName) => {
    setConfirmDialog({
      message: '⚠️ استعادة نسخة احتياطية',
      subMessage: 'سيتم حذف جميع البيانات الحالية واستبدالها بالبيانات الموجودة في النسخة. هل تريد الاستمرار؟',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const data = await api.restoreBackup(fileName);
          setOrders(data);
          setShowRestoreList(false);
          addToast(`تم استعادة النسخة بنجاح (${data.length} أمر)`);
          refreshData();
        } catch {
          addToast('فشل في استعادة النسخة', 'error');
        }
      }
    });
  };

  const handleImportClick = () => {
    setShowBackupMenu(false);
    setConfirmDialog({
      message: '⚠️ تحذير: استعادة نسخة احتياطية',
      subMessage: 'سيتم حذف جميع البيانات الحالية واستبدالها بالبيانات الموجودة في الملف. يُنصح بأخذ نسخة احتياطية أولاً قبل المتابعة. هل تريد الاستمرار؟',
      onConfirm: () => {
        setConfirmDialog(null);
        fileInputRef.current?.click();
      }
    });
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await api.importData(file);
      setOrders(data);
      addToast(`تم استعادة ${data.length} أمر بنجاح`);
      refreshData();
    } catch (err) {
      addToast(err.message || 'فشل في استعادة النسخة الاحتياطية', 'error');
    }

    e.target.value = '';
  };

  // Print view
  if (printData) {
    return (
      <PrintView
        order={printData.order}
        orders={printData.orders}
        singleItem={printData.singleItem}
        onClose={() => {
          setPrintData(null);
          setSelectedItems(new Set()); // Auto-clear selection after printing
        }}
      />
    );
  }

  return (
    <>
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-right">
          <div className="app-logo">K</div>
          <div>
            <h1 className="app-title">Kareem Hussien</h1>
            <p className="app-subtitle">إدارة الشركة</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={toggleTheme} 
            title={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            style={{ fontWeight: 600 }}
          >
            {theme === 'dark' ? (
              <><FiSun style={{ fontSize: '1.1rem' }} /> وضع نهاري</>
            ) : (
              <><FiMoon style={{ fontSize: '1.1rem' }} /> وضع ليلي</>
            )}
          </button>
          
          <button className="btn btn-primary" onClick={() => { setEditingOrder(null); setShowOrderModal(true); }}>
            <FiPlus /> تسجيل أمر / طلب
          </button>
          <button 
            className={`btn ${selectedItems.size > 0 ? 'btn-success' : 'btn-secondary'}`} 
            onClick={handlePrintSelected} 
            title="طباعة الأوامر المحددة"
          >
            <FiPrinter /> طباعة المحددة {selectedItems.size > 0 ? `(${selectedItems.size})` : ''}
          </button>

          {/* Backup Menu Dropdown */}
          <div className="backup-menu-container" ref={backupMenuRef}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowBackupMenu(!showBackupMenu)}
            >
              <FiShield /> النسخ الاحتياطي <FiChevronDown className={`backup-chevron ${showBackupMenu ? 'open' : ''}`} />
            </button>

            {showBackupMenu && (
              <div className="backup-dropdown">
                <div className="backup-dropdown-header">
                  <FiShield />
                  <span>إدارة النسخ الاحتياطي</span>
                </div>

                {/* Auto-backup status */}
                <div className="backup-status-bar">
                  <div className={`backup-status-dot ${backupPath ? 'active' : ''}`}></div>
                  <span>{backupPath ? 'النسخ التلقائي مفعّل' : 'النسخ التلقائي غير مفعّل'}</span>
                </div>
                {backupPath && (
                  <div className="backup-path-display">
                    <FiFolder style={{ flexShrink: 0 }} />
                    <span>{backupPath}</span>
                  </div>
                )}

                <button className="backup-dropdown-item" onClick={handleSelectBackupFolder}>
                  <div className="backup-item-icon export">
                    <FiFolder />
                  </div>
                  <div className="backup-item-content">
                    <div className="backup-item-title">{backupPath ? 'تغيير مكان الحفظ' : 'تفعيل النسخ التلقائي'}</div>
                    <div className="backup-item-desc">اختر مجلد لحفظ النسخ الاحتياطية JSON تلقائياً</div>
                  </div>
                </button>

                {backupPath && (
                  <button className="backup-dropdown-item" onClick={handleLoadBackupList}>
                    <div className="backup-item-icon import">
                      <FiRefreshCw />
                    </div>
                    <div className="backup-item-content">
                      <div className="backup-item-title">استعادة من النسخ التلقائية</div>
                      <div className="backup-item-desc">اختر نسخة احتياطية لاستعادتها</div>
                    </div>
                  </button>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0' }}></div>

                <button className="backup-dropdown-item" onClick={handleExport}>
                  <div className="backup-item-icon export">
                    <FiDownload />
                  </div>
                  <div className="backup-item-content">
                    <div className="backup-item-title">تصدير يدوي</div>
                    <div className="backup-item-desc">تحميل ملف JSON على جهازك</div>
                  </div>
                </button>

                <button className="backup-dropdown-item" onClick={handleImportClick}>
                  <div className="backup-item-icon import">
                    <FiUpload />
                  </div>
                  <div className="backup-item-content">
                    <div className="backup-item-title">استيراد من ملف</div>
                    <div className="backup-item-desc">استعادة بيانات من ملف JSON محفوظ</div>
                  </div>
                </button>

                <div className="backup-dropdown-warning">
                  <FiAlertTriangle />
                  <span>{backupPath ? 'يتم حفظ نسخة تلقائياً بعد كل عملية' : 'فعّل النسخ التلقائي لحماية بياناتك'}</span>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </div>
      </header>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon purple"><FiPackage /></div>
          <div>
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-label">إجمالي الأوامر</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiLayers /></div>
          <div>
            <div className="stat-value">{stats.totalItems}</div>
            <div className="stat-label">إجمالي الطلبات</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><FiBox /></div>
          <div>
            <div className="stat-value">{stats.totalQuantity}</div>
            <div className="stat-label">إجمالي الكميات</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><FiUsers /></div>
          <div>
            <div className="stat-value">{stats.uniqueClients}</div>
            <div className="stat-label">العملاء</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="بحث سريع بالأمر، العميل، أو الصنف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FiSearch className="search-icon" />
        </div>
        
        <button 
          className={`btn btn-sm ${showFilters || hasActiveFilters ? 'btn-filter-active' : 'btn-secondary'}`} 
          onClick={() => setShowFilters(!showFilters)}
        >
          <FiFilter /> بحث متقدم
          {hasActiveFilters && <span className="filter-badge">!</span>}
        </button>

        <div className="selection-actions" style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button className="btn btn-sm btn-secondary" onClick={handleSelectAll}>
            تحديد الكل
          </button>
          {selectedItems.size > 0 && (
            <button className="btn btn-sm btn-danger" onClick={handleClearSelection}>
              إلغاء التحديد
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-panel-header">
            <div className="filters-panel-title">
              <FiFilter style={{ fontSize: '1rem' }} />
              <span>عوامل التصفية المتقدمة</span>
            </div>
            {hasActiveFilters && (
              <button className="btn btn-sm btn-danger" onClick={clearFilters}>
                <FiX style={{ fontSize: '0.75rem' }} /> مسح الفلاتر
              </button>
            )}
          </div>
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">رقم الأمر</label>
              <input
                type="text"
                className="filter-input"
                placeholder="بحث برقم الأمر"
                value={filters.orderNumber}
                onChange={(e) => handleFilterChange('orderNumber', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">اسم العميل</label>
              <input
                type="text"
                className="filter-input"
                placeholder="بحث باسم العميل"
                value={filters.clientName}
                onChange={(e) => handleFilterChange('clientName', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">اسم الصنف</label>
              <input
                type="text"
                className="filter-input"
                placeholder="بحث باسم الصنف"
                value={filters.itemName}
                onChange={(e) => handleFilterChange('itemName', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">العرض / المقاس</label>
              <input
                type="text"
                className="filter-input"
                placeholder="بحث بالعرض"
                value={filters.sizeFilter}
                onChange={(e) => handleFilterChange('sizeFilter', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">تاريخ الطلب</label>
              <input
                type="date"
                className="filter-input"
                value={filters.dateFilter}
                onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="filters-active-info">
              <FiSearch style={{ fontSize: '0.85rem', opacity: 0.7 }} />
              <span>يتم تطبيق الفلاتر تلقائياً أثناء الكتابة</span>
            </div>
          )}
        </div>
      )}

      {/* View Tabs Switcher */}
      <div className="view-tabs">
        <button 
          className={`view-tab ${activeTab === 'flat' ? 'active' : ''}`}
          onClick={() => setActiveTab('flat')}
        >
          <FiList /> الطلبات الحالية
        </button>
        <button 
          className={`view-tab ${activeTab === 'archive' ? 'active' : ''}`}
          onClick={() => setActiveTab('archive')}
        >
          <FiArchive /> أرشيف الأوامر
        </button>
      </div>

      {/* Orders/Items List */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ animation: 'pulse 1.5s infinite' }}>⏳</div>
          <h3 className="empty-state-title">جاري التحميل...</h3>
        </div>
      ) : orders.length > 0 ? (
        activeTab === 'flat' ? (
          <FlatItemsView 
            orders={orders}
            selectedItems={selectedItems}
            onToggleItem={handleToggleItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        ) : (
          <div className="orders-grid">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                selectedItems={selectedItems}
                onToggleOrder={handleToggleOrder}
                onToggleItem={handleToggleItem}
                onEditOrder={handleEditOrder}
                onAddItem={handleAddItem}
                onEditItem={handleEditItem}
                onDeleteItem={handleDeleteItem}
                onDeleteOrder={handleDeleteOrder}
              />
            ))}
          </div>
        )
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3 className="empty-state-title">
            {searchQuery || hasActiveFilters ? 'لا توجد نتائج' : 'لا توجد أوامر بعد'}
          </h3>
          <p className="empty-state-desc">
            {searchQuery || hasActiveFilters
              ? 'جرب تغيير عوامل البحث أو التصفية'
              : 'ابدأ بتسجيل أمر / طلب جديد باستخدام الزر أعلاه'}
          </p>
          {!searchQuery && !hasActiveFilters && (
            <button
              className="btn btn-primary"
              onClick={() => { setEditingOrder(null); setShowOrderModal(true); }}
            >
              <FiPlus /> تسجيل أول أمر
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showOrderModal && (
        <OrderModal
          order={editingOrder}
          onSave={handleSaveOrder}
          onClose={() => { setShowOrderModal(false); setEditingOrder(null); }}
          existingOrders={orders}
        />
      )}

      {showItemModal && (
        <ItemModal
          item={editingItem}
          onSave={handleSaveItem}
          onClose={() => { setShowItemModal(false); setEditingItem(null); setActiveOrderId(null); }}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          subMessage={confirmDialog.subMessage}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Restore List Modal */}
      {showRestoreList && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>استعادة من النسخ التلقائية</h2>
              <button className="icon-btn" onClick={() => setShowRestoreList(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {backupList.length === 0 ? (
                <div className="empty-state">
                  <FiAlertTriangle className="empty-state-icon" style={{ opacity: 0.5 }} />
                  <p>لا توجد نسخ احتياطية متاحة في المجلد المحدد</p>
                </div>
              ) : (
                <div className="backup-list">
                  {backupList.map((backup, index) => (
                    <div key={index} className="backup-list-item">
                      <div className="backup-list-info">
                        <FiClock className="backup-list-icon" />
                        <div>
                          <div className="backup-list-date">{backup.date}</div>
                          <div className="backup-list-size">{backup.size}</div>
                        </div>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleRestoreBackup(backup.name)}
                      >
                        استعادة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRestoreList(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <Toast toasts={toasts} removeToast={removeToast} />
    </div>

    {/* Footer - outside container for full width */}
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-dev">
          <FiCode className="footer-dev-icon" />
          <span>تطوير <strong>Abdulrhman Nofal</strong></span>
        </div>
        <div className="footer-separator"></div>
        <div className="footer-links">
          <a href="tel:01027545916" className="footer-link" title="اتصل بي">
            <FiPhone /> 01027545916
          </a>
          <a href="https://www.facebook.com/bdalrhmnmhmd.900795" target="_blank" rel="noopener noreferrer" className="footer-link footer-link-social footer-link-fb" title="Facebook">
            <FaFacebookF />
          </a>
          <a href="https://www.linkedin.com/in/abdulrhman-nofal-113b96387" target="_blank" rel="noopener noreferrer" className="footer-link footer-link-social footer-link-li" title="LinkedIn">
            <FaLinkedinIn />
          </a>
        </div>
      </div>
    </footer>
    </>
  );
}

export default App;