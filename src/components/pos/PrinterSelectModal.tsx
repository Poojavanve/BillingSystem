import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface PrinterSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (printerName: string) => void;
  title?: string;
}

export const PrinterSelectModal: React.FC<PrinterSelectModalProps> = ({ isOpen, onClose, title = 'Select Printer' }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <Button variant="secondary" onClick={onClose}>Close</Button>
      }
    >
      <p className="text-sm text-slate-600">
        Printing functionality has been removed. Please use your browser's native print dialog.
      </p>
    </Modal>
  );
};
