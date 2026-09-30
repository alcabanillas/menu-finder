// Schema of the decomposer golden set (MF-13, spec decomposer-golden-set).
import { z } from "zod";

export type Issue = {
  request?: string;
  constraint?: string;
  field?: string;
  message: string;
};

export type RetrievalQuery = { id: string; text: string };

// Minimal schema: only what BUS-superficie-consulta already decides (design D4).
const constraintSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(["literal", "exclusion", "attribute", "fuzzy"]),
  term: z.string().min(1),
  polarity: z.enum(["include", "exclude"]),
  hard: z.boolean(),
  slot: z.enum(["lunch", "dinner"]).optional(),
});

const requestSchema = z.strictObject({
  id: z.string().min(1),
  text: z.string().min(1),
  origin: z.enum(["retrieval-golden-set", "llm-blind"]),
  constraints: z.array(constraintSchema),
  sameDish: z.array(z.array(z.string())),
  anyOf: z.array(z.array(z.string())),
});

type Request = z.infer<typeof requestSchema>;

// Reads an id from raw data, so that a schema issue can name its request or constraint.
const idOf = (raw: unknown, index: number): string =>
  typeof raw === "object" && raw !== null && typeof (raw as { id?: unknown }).id === "string"
    ? (raw as { id: string }).id
    : `#${index}`;

function toIssue(raw: unknown, index: number, issue: z.core.$ZodIssue): Issue {
  const request = idOf(raw, index);
  const keys = issue.code === "unrecognized_keys" ? issue.keys.join(", ") : undefined;
  const [first, position, ...rest] = issue.path;
  if (first === "constraints" && typeof position === "number") {
    const constraints = (raw as { constraints: unknown[] }).constraints;
    const field = keys ?? rest.join(".");
    return { request, constraint: idOf(constraints[position], position), field, message: issue.message };
  }
  return { request, field: keys ?? issue.path.join("."), message: issue.message };
}

function parseRequests(goldenSet: unknown, issues: Issue[]): Request[] {
  if (!Array.isArray(goldenSet)) {
    issues.push({ message: "the golden set must be an array of requests" });
    return [];
  }
  const requests: Request[] = [];
  goldenSet.forEach((raw, index) => {
    const parsed = requestSchema.safeParse(raw);
    if (parsed.success) {
      requests.push(parsed.data);
      return;
    }
    issues.push(...parsed.error.issues.map((issue) => toIssue(raw, index, issue)));
  });
  return requests;
}

function checkConstraints(request: Request, issues: Issue[]): void {
  const seen = new Set<string>();
  const text = request.text.toLowerCase();
  for (const constraint of request.constraints) {
    const at = { request: request.id, constraint: constraint.id };
    if (seen.has(constraint.id)) {
      issues.push({ ...at, field: "id", message: "duplicate constraint id" });
    }
    seen.add(constraint.id);
    if (constraint.type === "exclusion" && constraint.polarity !== "exclude") {
      issues.push({ ...at, field: "polarity", message: "an exclusion must have polarity exclude" });
    }
    if (!text.includes(constraint.term)) {
      issues.push({ ...at, field: "term", message: `term "${constraint.term}" is not in the request text` });
    }
  }
}

// sameDish: the constraints that one dish must satisfy ("con"). anyOf: alternatives, any of
// which satisfies the condition ("o"). BUS-superficie-consulta (a).
type GroupField = "sameDish" | "anyOf";

function checkGroups(request: Request, field: GroupField, issues: Issue[]): void {
  const known = new Set(request.constraints.map((constraint) => constraint.id));
  const grouped = new Set<string>();
  for (const group of request[field]) {
    if (group.length < 2) {
      issues.push({ request: request.id, field, message: "a group needs two or more constraints" });
    }
    for (const id of group) {
      const at = { request: request.id, constraint: id, field };
      if (!known.has(id)) issues.push({ ...at, message: "group names an unknown constraint" });
      if (grouped.has(id)) issues.push({ ...at, message: "constraint is in more than one group" });
      grouped.add(id);
    }
  }
}

// "o" in an exclusion is "ni" (two exclusions), and "o" inside "con" is left to T3.
function checkAlternatives(request: Request, issues: Issue[]): void {
  const excluded = new Set(request.constraints.filter((c) => c.polarity === "exclude").map((c) => c.id));
  const sameDish = new Set(request.sameDish.flat());
  for (const id of new Set(request.anyOf.flat())) {
    const at = { request: request.id, constraint: id, field: "anyOf" };
    if (excluded.has(id)) issues.push({ ...at, message: "an alternative must have polarity include" });
    if (sameDish.has(id)) issues.push({ ...at, message: "constraint is in both an anyOf and a sameDish group" });
  }
}

const LONG_REQUESTS = 7;
const LONG_MIN_CONSTRAINTS = 3;
const LONG_MIN_TYPES = 2;

// The golden set is the retrieval queries plus seven long requests with several constraints.
function checkComposition(requests: Request[], retrievalQueries: RetrievalQuery[], issues: Issue[]): void {
  const retrievalIds = new Set(retrievalQueries.map((query) => query.id));
  const long = requests.filter((request) => request.origin === "llm-blind");
  if (long.length !== LONG_REQUESTS) {
    issues.push({ message: `expected ${LONG_REQUESTS} long requests, found ${long.length}` });
  }
  for (const request of long) {
    const types = new Set(request.constraints.map((constraint) => constraint.type));
    if (request.constraints.length < LONG_MIN_CONSTRAINTS || types.size < LONG_MIN_TYPES) {
      issues.push({
        request: request.id,
        field: "constraints",
        message: `a long request needs ${LONG_MIN_CONSTRAINTS}+ constraints of ${LONG_MIN_TYPES}+ types`,
      });
    }
  }
  for (const request of requests) {
    if (request.origin === "retrieval-golden-set" && !retrievalIds.has(request.id)) {
      issues.push({ request: request.id, field: "origin", message: "not a retrieval query" });
    }
  }
}

function checkIds(requests: Request[], issues: Issue[]): void {
  const seen = new Set<string>();
  for (const request of requests) {
    if (seen.has(request.id)) {
      issues.push({ request: request.id, field: "id", message: "duplicate id" });
    }
    seen.add(request.id);
  }
}

function checkRetrievalParity(requests: Request[], retrievalQueries: RetrievalQuery[], issues: Issue[]): void {
  const byId = new Map(requests.map((request) => [request.id, request]));
  for (const query of retrievalQueries) {
    const request = byId.get(query.id);
    if (!request) {
      issues.push({ request: query.id, message: "retrieval query missing from the golden set" });
    } else if (request.text !== query.text) {
      issues.push({ request: query.id, field: "text", message: `text differs from retrieval ("${query.text}")` });
    }
  }
}

export function validateGoldenSet(goldenSet: unknown, retrievalQueries: RetrievalQuery[]): Issue[] {
  const issues: Issue[] = [];
  const requests = parseRequests(goldenSet, issues);
  checkIds(requests, issues);
  for (const request of requests) {
    checkConstraints(request, issues);
    checkGroups(request, "sameDish", issues);
    checkGroups(request, "anyOf", issues);
    checkAlternatives(request, issues);
  }
  checkRetrievalParity(requests, retrievalQueries, issues);
  checkComposition(requests, retrievalQueries, issues);
  return issues;
}
