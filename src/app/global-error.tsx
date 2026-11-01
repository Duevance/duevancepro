'use client';
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: 'system-ui', padding: 40 }}><h1>Something went wrong</h1><p>Please try again. If it keeps happening, contact support.</p><button onClick={reset}>Try again</button></body></html>;
}
