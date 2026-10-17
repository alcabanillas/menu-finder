import { z } from 'zod';

// Only the two words are accepted: a date or any other text is refused, so the start date never comes from the request.
export const weekInput = z.enum(['current', 'next']);
