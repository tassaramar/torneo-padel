/**
 * Sistema de notificaciones toast para feedback al usuario
 *
 * Uso:
 * import { showToast } from './utils/toast.js';
 *
 * showToast('Operación exitosa', 'success');
 * showToast('Error al guardar', 'error');
 */

/**
 * Muestra un toast temporal al usuario
 *
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'info'} type - Tipo de toast (determina color)
 * @param {number} duration - Duración en ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Crear elemento toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Agregar al DOM
  document.body.appendChild(toast);

  // Trigger animación de entrada (después de que el elemento esté en el DOM)
  setTimeout(() => {
    toast.classList.add('toast-show');
  }, 10);

  // Remover después de duration
  setTimeout(() => {
    toast.classList.remove('toast-show');

    // Esperar fin de animación de salida antes de remover del DOM
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}
