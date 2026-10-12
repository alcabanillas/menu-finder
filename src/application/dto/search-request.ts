import { z } from 'zod';
import {
  CONSTRAINT_TYPES,
  findRequestIssues,
  POLARITIES,
  SLOTS,
  type Constraint,
  type ConstraintType,
  type Polarity,
  type RequestIssue,
  type SearchRequest,
  type Slot,
} from '@/domain/search/search-request';
import { err, ok, type Result } from '@/shared/result';

/** Limit of a term (spec menu-search, "Request structure"), so that a request cannot exhaust the quota or the memory. */
const MAX_TERM_LENGTH = 100;
/** Limit of the structure (spec menu-search, "Request structure"), so that a request cannot exhaust the quota or the memory. */
const MAX_CONSTRAINTS = 12;

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

// The schema must accept exactly the shape of the DTO: `satisfies` breaks the build if they drift apart.
const searchRequestSchema = z.strictObject({
  constraints: z.array(constraintSchema).min(1).max(MAX_CONSTRAINTS),
  sameDish: z.array(z.array(z.string())).default([]),
  anyOf: z.array(z.array(z.string())).default([]),
}) satisfies z.ZodType<unknown, SearchRequestDto>;

type ValidDto = z.output<typeof searchRequestSchema>;

/**
 * Validates the DTO before any query and turns it into the domain request. The shape is checked first; the
 * rules across constraints and groups run only on a well-formed shape, so a rejected DTO names the fields of the
 * first stage that fails. The DTO comes from outside, so its type is a contract, not a guarantee.
 */
export function parseSearchRequest(dto: SearchRequestDto): Result<SearchRequest, SearchRequestError> {
  const parsed = searchRequestSchema.safeParse(dto);
  if (!parsed.success) return invalid(parsed.error.issues.map((issue) => toIssue(dto, issue)));
  const request = toSearchRequest(parsed.data);
  const issues = findRequestIssues(request);
  return issues.length > 0 ? invalid(issues) : ok(request);
}

// Names the field that failed; for a constraint, its id too, read from the unvalidated DTO.
function toIssue(dto: unknown, issue: z.core.$ZodIssue): RequestIssue {
  const keys = issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : undefined;
  const [first, position, ...rest] = issue.path;
  if (first === 'constraints' && typeof position === 'number') {
    const field = keys ?? (rest.length > 0 ? rest.join('.') : 'constraints');
    return { constraint: constraintIdAt(dto, position), field, message: issue.message };
  }
  return { field: keys ?? (first === undefined ? 'structure' : String(first)), message: issue.message };
}

function constraintIdAt(dto: unknown, position: number): string {
  const constraints = (dto as { constraints?: unknown[] }).constraints;
  const id = (constraints?.[position] as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : `#${position}`;
}

function invalid(issues: RequestIssue[]): Result<never, SearchRequestError> {
  return err({ kind: 'invalid-request', issues });
}

function toSearchRequest({ constraints, sameDish, anyOf }: ValidDto): SearchRequest {
  return { constraints: constraints.map(toConstraint), sameDish, anyOf };
}

function toConstraint({ id, type, term, polarity, hard, slot }: ValidDto['constraints'][number]): Constraint {
  return slot === undefined ? { id, type, term, polarity, hard } : { id, type, term, polarity, hard, slot };
}
