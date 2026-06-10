import { createPortal } from 'react-dom';

/** Dims the app behind Paystack so checkout feels like a modal, not a blank page. */
export default function PaystackPageOverlay({ open }: { open: boolean }) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-[2px] pointer-events-none transition-opacity"
      aria-hidden
    />,
    document.body
  );
}
