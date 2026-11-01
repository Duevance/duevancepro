/** Accurate labels: opening a link is never described as sending. */
export function activityLabel(l: { action_type: string; channel: string | null; stage: string | null }): string {
  const tone = l.stage ? ` (${l.stage})` : '';
  switch (l.action_type) {
    case 'prepared': return `Reminder prepared${tone}`;
    case 'link_opened': return `${l.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} link opened${tone}. Not confirmed as sent`;
    case 'copied': return `Message copied${tone}`;
    case 'marked_sent': return `Marked as sent by you via ${l.channel ?? 'unspecified channel'}${tone}`;
    case 'marked_paid': return 'Invoice marked paid';
    case 'status_changed': return 'Invoice status changed';
    default: return l.action_type;
  }
}
