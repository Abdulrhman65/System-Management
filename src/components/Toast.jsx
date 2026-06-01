import { useEffect } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

const icons = {
  success: <FiCheckCircle />,
  error: <FiAlertCircle />,
  info: <FiInfo />,
};

function Toast({ toasts, removeToast }) {
  return (
    <div className="toasts-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, removeToast }) {
  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div className={`toast ${toast.type}`}>
      <span className="toast-icon">{icons[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}

export default Toast;
