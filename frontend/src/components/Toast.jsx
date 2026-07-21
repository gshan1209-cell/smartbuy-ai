export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
        background: 'rgba(30,28,26,.94)', color: '#fff',
        padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        boxShadow: '0 6px 18px rgba(0,0,0,.2)', maxWidth: 280,
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}
