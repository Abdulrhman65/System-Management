import { FiAlertTriangle } from 'react-icons/fi';

function ConfirmDialog({ message, subMessage, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-body">
          <div className="confirm-content">
            <div className="confirm-icon">
              <FiAlertTriangle />
            </div>
            <p className="confirm-text">{message}</p>
            {subMessage && <p className="confirm-subtext">{subMessage}</p>}
            <div className="confirm-actions">
              <button className="btn btn-danger" onClick={onConfirm}>
                نعم، احذف
              </button>
              <button className="btn btn-secondary" onClick={onCancel}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
