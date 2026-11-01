import { ImageResponse } from 'next/og';
export const alt = 'Duevance: Get paid. Move forward.'; export const size = { width: 1200, height: 630 }; export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    (<div style={{ width: '100%', height: '100%', background: '#0C1226', color: '#F7F5F1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80 }}>
      <svg width="96" height="96" viewBox="0 0 48 48"><path d="M12 8H22A16 16 0 0 1 36.83 18M36.83 30A16 16 0 0 1 22 40H12" stroke="#F7F5F1" strokeWidth="7" fill="none" /><path d="M19 24H43" stroke="#5FE0A8" strokeWidth="6" strokeLinecap="round" /></svg>
      <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Get paid. Move forward.</div>
      <div style={{ fontSize: 34, color: '#AAB2D1' }}>Invoice follow-up for freelancers and small businesses</div></div>), size);
}
