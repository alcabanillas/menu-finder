/** What a search takes (spec menu-search, "Request structure"): a typed structure of constraints, not text. */
type ConstraintType = 'literal' | 'exclusion' | 'attribute' | 'fuzzy';
type Polarity = 'include' | 'exclude';
type Slot = 'lunch' | 'dinner';

export type Constraint = {
  id: string;
  type: ConstraintType;
  term: string;
  polarity: Polarity;
  hard: boolean;
  slot?: Slot;
};

export type SearchRequest = {
  constraints: Constraint[];
  /** The constraints that one dish must satisfy together ("con"). */
  sameDish: string[][];
  /** Alternatives, any of which satisfies the condition ("o"). */
  anyOf: string[][];
};

export type RequestIssue = {
  /** The id of the constraint the issue is about, when there is one. */
  constraint?: string;
  field: string;
  message: string;
};

type GroupField = 'sameDish' | 'anyOf';

/** The rules of a request across its constraints and groups: ids, polarity and group membership. Empty when it is valid. */
export function findRequestIssues(request: SearchRequest): RequestIssue[] {
  return [
    ...checkIds(request),
    ...checkPolarity(request),
    ...checkGroups(request, 'sameDish'),
    ...checkGroups(request, 'anyOf'),
  ];
}

// A group names constraints by id, so a repeated id would make a group ambiguous.
function checkIds({ constraints }: SearchRequest): RequestIssue[] {
  const seen = new Set<string>();
  const issues: RequestIssue[] = [];
  for (const { id } of constraints) {
    if (seen.has(id)) issues.push({ constraint: id, field: 'id', message: 'duplicate constraint id' });
    seen.add(id);
  }
  return issues;
}

// An exclusion is a constraint to avoid, so it cannot have polarity include.
function checkPolarity({ constraints }: SearchRequest): RequestIssue[] {
  return constraints
    .filter((constraint) => constraint.type === 'exclusion' && constraint.polarity === 'include')
    .map((constraint) => ({
      constraint: constraint.id,
      field: 'polarity',
      message: 'an exclusion must have polarity exclude',
    }));
}

// The groups are checked in order, sameDish first, so a constraint in both kinds is reported on anyOf.
function checkGroups(request: SearchRequest, field: GroupField): RequestIssue[] {
  const issues: RequestIssue[] = [];
  const known = new Map(request.constraints.map((constraint) => [constraint.id, constraint]));
  const taken = idsInGroups(request, field === 'sameDish' ? [] : ['sameDish']);
  for (const group of request[field]) {
    if (group.length < 2) issues.push({ field, message: 'a group needs two or more constraints' });
    for (const id of group) {
      issues.push(...checkMember(id, known.get(id), field, taken));
      taken.add(id);
    }
  }
  return issues;
}

function idsInGroups(request: SearchRequest, fields: GroupField[]): Set<string> {
  return new Set(fields.flatMap((field) => request[field].flat()));
}

function checkMember(
  id: string,
  member: Constraint | undefined,
  field: GroupField,
  taken: Set<string>,
): RequestIssue[] {
  if (!member) return [{ constraint: id, field, message: 'group names an unknown constraint' }];
  const issues: RequestIssue[] = [];
  if (taken.has(id)) issues.push({ constraint: id, field, message: 'constraint is in more than one group' });
  if (field === 'anyOf' && member.polarity === 'exclude') {
    issues.push({ constraint: id, field, message: 'an alternative must have polarity include' });
  }
  return issues;
}
