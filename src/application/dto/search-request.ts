import { z } from 'zod';
import {
  CONSTRAINT_TYPES,
  POLARITIES,
  SLOTS,
  type ConstraintType,
  type Polarity,
  type Slot,
} from '@/domain/search/search-request';

/** Limit of a term (spec menu-search, "Request structure"), so that a request cannot exhaust the quota or the memory. */
const MAX_TERM_LENGTH = 100;

/**
 * The shape of one constraint, as a schema: fields, types and limits only. The rules across constraints and groups
 * stay in `searchMenus`. It lives with the DTO because two boundaries share it: the input of `searchMenus` and the
 * answer of the decomposer port (MF-40.2 design D2).
 */
export const constraintSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(CONSTRAINT_TYPES),
  term: z.string().trim().min(1).max(MAX_TERM_LENGTH),
  polarity: z.enum(POLARITIES),
  hard: z.boolean(),
  slot: z.enum(SLOTS).optional(),
}) satisfies z.ZodType<unknown, ConstraintDto>;

/**
 * The structure of a search as it comes from outside: what the decomposer emits from a request (BUS-descomponedor),
 * and the expected structure of the decomposer golden set (spec menu-search, "Request structure"). It is not
 * trusted: `searchMenus` validates it and turns it into the domain request.
 */
export type SearchRequestDto = {
  constraints: ConstraintDto[];
  sameDish?: string[][];
  anyOf?: string[][];
};

type ConstraintDto = {
  id: string;
  type: ConstraintType;
  term: string;
  polarity: Polarity;
  hard: boolean;
  slot?: Slot;
};

export type SearchRequestIssue = {
  /** The id of the constraint the issue is about, when there is one. */
  constraint?: string;
  field: string;
  message: string;
};

/** A structure rejected before any query: every issue names its field and, when there is one, its constraint. */
export type SearchRequestError = { kind: 'invalid-request'; issues: SearchRequestIssue[] };
