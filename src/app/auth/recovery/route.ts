import type { NextRequest } from 'next/server';
import { completeAuthLink } from '@/lib/authCallback';
/** Password-reset links land here and always continue to the set-new-password page. */
export const GET = (req: NextRequest) => completeAuthLink(req, '/reset-password');
