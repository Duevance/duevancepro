import type { NextRequest } from 'next/server';
import { completeAuthLink } from '@/lib/authCallback';
import { safeNext } from '@/lib/auth';
/** Email confirmation lands here, then the user continues to the app (onboarding if new). */
export const GET = (req: NextRequest) => completeAuthLink(req, safeNext(req.nextUrl.searchParams.get('next')));
