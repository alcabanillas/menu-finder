import { headers } from 'next/headers';

export type RequestHeaders = () => Promise<Headers>;

/** The only place that reads `next/headers` (ADR-001 §5): everything else receives the headers injected. */
export const nextRequestHeaders: RequestHeaders = headers;
