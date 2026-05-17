export default function OfflineBanner({ online }) {
  if (online) return null;
  return (
    <div className="offline-banner">
      📴 You're offline — changes will sync when you reconnect
    </div>
  );
}
