import { useRef } from 'react';
import Button from './Button';
import Modal from './Modal';

/**
 * Confirmación accesible. Por defecto el foco inicial queda en "Cancelar"
 * para reducir el riesgo de confirmar acciones destructivas con el teclado.
 */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  isLoading = false,
}) {
  const cancelarRef = useRef(null);

  const manejarCierre = () => {
    if (!isLoading) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={manejarCierre}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      initialFocus={cancelarRef}
      footer={
        <>
          <Button
            ref={cancelarRef}
            variant="secondary"
            onClick={manejarCierre}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            isLoading={isLoading}
            loadingLabel="Procesando…"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export default ConfirmDialog;
