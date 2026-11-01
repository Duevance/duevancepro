'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div className="empty"><h2>Something went wrong</h2><p>The page could not load. Your data is safe. Try again, and contact support if it keeps happening.</p><button className="btn btn-ink" onClick={reset}>Try again</button></div>;
}
