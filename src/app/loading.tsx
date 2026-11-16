export default function Loading() {
  return (
    <div className="loading-shell" role="status">
      <div className="spinner" />
      <span className="sr-only">Finding your connection…</span>
    </div>
  );
}
