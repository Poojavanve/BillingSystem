import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { NumericInput } from '../ui/NumericInput';
import { Button } from '../ui/Button';

interface PrintQuantityModalProps {
  isOpen: boolean;
  defaultQuantity: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

export const PrintQuantityModal: React.FC<PrintQuantityModalProps> = ({ isOpen, defaultQuantity, onClose, onConfirm }) => {
  const [quantity, setQuantity] = useState(defaultQuantity);

  useEffect(() => {
    if (isOpen) setQuantity(defaultQuantity);
  }, [isOpen, defaultQuantity]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Quantity"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={quantity <= 0} onClick={() => onConfirm(quantity)}>Print</Button>
        </>
      }
    >
      <label className="block text-sm text-slate-600 dark:text-slate-300">
        How many labels do you want to print?
        <div className="mt-1.5">
          <NumericInput value={quantity} onValueChange={setQuantity} integer min={1} autoFocus />
        </div>
      </label>
    </Modal>
  );
};
