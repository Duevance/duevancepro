import Link from 'next/link';
export default function NotFound() { return <div className="err-page"><div><h1 style={{ fontSize: '4rem' }}>Page not found</h1><p style={{ margin: '0 auto 20px' }}>The page may have moved, or the link is wrong.</p><Link className="btn btn-primary" href="/">Go to the homepage</Link></div></div>; }
