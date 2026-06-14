/**
 * useToast — lightweight toast notification system.
 *
 * Built on a module-level event emitter (ToastEmitter) so that toast calls
 * work from anywhere in the tree without needing a context provider at every
 * call site. The Toast UI component subscribes to toastEmitter and renders
 * the message.
 *
 * toastEmitter is also exported for the rare case where a toast needs to be
 * triggered from outside the React tree (e.g. a future API error interceptor).
 *
 * Usage: const toast = useToast(); toast.show('Message');
 */
type Listener = (msg: string) => void;

class ToastEmitter {
  private listeners: Set<Listener> = new Set();
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(msg: string) {
    this.listeners.forEach((fn) => fn(msg));
  }
}

export const toastEmitter = new ToastEmitter();

export function useToast() {
  return {
    show: (message: string) => toastEmitter.emit(message),
  };
}
