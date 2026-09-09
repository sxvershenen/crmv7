import React from 'react';
import { CompactToast } from '@crm/site-ui';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  return <CompactToast message={message} onClose={onClose} />;
};
