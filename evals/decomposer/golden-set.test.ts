import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Issue, type RetrievalQuery, validateGoldenSet } from "./golden-set-schema";

const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("decomposer golden set: committed file", () => {
  it("is valid against the retrieval queries", () => {
    const goldenSet = readJson("./golden-set.json");
    const retrievalQueries = readJson("../retrieval/queries.json") as RetrievalQuery[];

    expect(validateGoldenSet(goldenSet, retrievalQueries)).toEqual([]);
  });
});

const retrievalQueries: RetrievalQuery[] = [
  { id: "L06", text: "pollo" },
  { id: "F01", text: "de cuchara" },
];

const reused = (id: string, text: string) => ({
  id,
  text,
  origin: "retrieval-golden-set",
  constraints: [{ id: "c1", type: "literal", term: text, polarity: "include", hard: false }],
  sameDish: [],
  anyOf: [],
});

const validRequests = () => [reused("L06", "pollo"), reused("F01", "de cuchara")];

const issueFor = (issues: Issue[], expected: Partial<Issue>) =>
  issues.some((issue) =>
    Object.entries(expected).every(([key, value]) => issue[key as keyof Issue] === value),
  );

describe("decomposer golden set: requests", () => {
  it("accepts a golden set that reuses every retrieval query", () => {
    const issues = validateGoldenSet(validRequests(), retrievalQueries);

    expect(issues.filter((issue) => issue.request === "L06" || issue.request === "F01")).toEqual([]);
  });

  it("reports a retrieval query that is missing", () => {
    const issues = validateGoldenSet([reused("F01", "de cuchara")], retrievalQueries);

    expect(issueFor(issues, { request: "L06" })).toBe(true);
  });

  it("reports a text that differs from retrieval", () => {
    const issues = validateGoldenSet([reused("L06", "pollo"), reused("F01", "cuchara")], retrievalQueries);

    expect(issueFor(issues, { request: "F01", field: "text" })).toBe(true);
  });

  it("reports a duplicate id", () => {
    const long = { ...reused("R03", "algo"), origin: "llm-blind" };
    const issues = validateGoldenSet([...validRequests(), long, long], retrievalQueries);

    expect(issueFor(issues, { request: "R03", field: "id" })).toBe(true);
  });
});

describe("decomposer golden set: constraint schema", () => {
  const retrieval: RetrievalQuery[] = [{ id: "C05", text: "arroz sin carne" }];
  const withConstraints = (constraints: object[], sameDish: string[][] = []) => [
    { id: "C05", text: "arroz sin carne", origin: "retrieval-golden-set", constraints, sameDish, anyOf: [] },
  ];
  const rice = { id: "c1", type: "literal", term: "arroz", polarity: "include", hard: false };
  const noMeat = { id: "c2", type: "exclusion", term: "carne", polarity: "exclude", hard: false };

  it("accepts a valid request", () => {
    const issues = validateGoldenSet(withConstraints([rice, noMeat], [["c1", "c2"]]), retrieval);

    expect(issues.filter((issue) => issue.request === "C05")).toEqual([]);
  });

  it("reports an unknown type", () => {
    const issues = validateGoldenSet(withConstraints([{ ...rice, type: "hypernym" }]), retrieval);

    expect(issueFor(issues, { request: "C05", constraint: "c1", field: "type" })).toBe(true);
  });

  it("reports an exclusion with polarity include", () => {
    const issues = validateGoldenSet(withConstraints([{ ...noMeat, polarity: "include" }]), retrieval);

    expect(issueFor(issues, { request: "C05", constraint: "c2" })).toBe(true);
  });

  it("reports an extra field", () => {
    const issues = validateGoldenSet(withConstraints([{ ...noMeat, group: "carne" }]), retrieval);

    expect(issueFor(issues, { request: "C05", constraint: "c2", field: "group" })).toBe(true);
  });

  it("reports a term that is not in the request", () => {
    const issues = validateGoldenSet(withConstraints([{ ...noMeat, term: "cerdo" }]), retrieval);

    expect(issues.some((issue) => issue.request === "C05" && issue.message.includes("cerdo"))).toBe(true);
  });
});

describe("decomposer golden set: same-dish groups", () => {
  const retrieval: RetrievalQuery[] = [{ id: "C04", text: "salmón con verduras" }];
  const withGroups = (sameDish: string[][]) => [
    {
      id: "C04",
      text: "salmón con verduras",
      origin: "retrieval-golden-set",
      constraints: [
        { id: "c1", type: "literal", term: "salmón", polarity: "include", hard: false },
        { id: "c2", type: "fuzzy", term: "verduras", polarity: "include", hard: false },
      ],
      sameDish,
      anyOf: [],
    },
  ];

  it("reports a group with an unknown constraint", () => {
    const issues = validateGoldenSet(withGroups([["c1", "c9"]]), retrieval);

    expect(issueFor(issues, { request: "C04", constraint: "c9" })).toBe(true);
  });

  it("reports a group of one", () => {
    const issues = validateGoldenSet(withGroups([["c1"]]), retrieval);

    expect(issueFor(issues, { request: "C04", field: "sameDish" })).toBe(true);
  });

  it("reports a constraint in two groups", () => {
    const issues = validateGoldenSet(withGroups([["c1", "c2"], ["c2", "c1"]]), retrieval);

    expect(issueFor(issues, { request: "C04", constraint: "c1", field: "sameDish" })).toBe(true);
  });
});

describe("decomposer golden set: alternatives groups", () => {
  const chickpeas = { id: "c1", type: "literal", term: "garbanzos", polarity: "include", hard: false };
  const lentils = { id: "c2", type: "literal", term: "lentejas", polarity: "include", hard: false };
  const withAlternatives = (anyOf: string[][], sameDish: string[][] = [], second: object = lentils) => [
    {
      id: "R02",
      text: "garbanzos o lentejas",
      origin: "llm-blind",
      constraints: [chickpeas, second],
      sameDish,
      anyOf,
    },
  ];

  it("reports a group of one", () => {
    const issues = validateGoldenSet(withAlternatives([["c1"]]), []);

    expect(issueFor(issues, { request: "R02", field: "anyOf", message: "a group needs two or more constraints" })).toBe(
      true,
    );
  });

  it("reports a group with an unknown constraint", () => {
    const issues = validateGoldenSet(withAlternatives([["c1", "c9"]]), []);

    expect(issueFor(issues, { request: "R02", constraint: "c9", field: "anyOf" })).toBe(true);
  });

  it("reports an excluded alternative", () => {
    const noLentils = { ...lentils, type: "exclusion", polarity: "exclude" };
    const issues = validateGoldenSet(withAlternatives([["c1", "c2"]], [], noLentils), []);

    expect(issueFor(issues, { request: "R02", constraint: "c2", field: "anyOf" })).toBe(true);
  });

  it("reports a constraint in both kinds of group", () => {
    const issues = validateGoldenSet(withAlternatives([["c1", "c2"]], [["c1", "c2"]]), []);

    expect(issueFor(issues, { request: "R02", constraint: "c1", field: "anyOf" })).toBe(true);
  });
});

describe("decomposer golden set: composition", () => {
  const long = (id: string, constraints: object[]) => ({
    id,
    text: "algo de cuchara y pollo sin cerdo",
    origin: "llm-blind",
    constraints,
    sameDish: [],
    anyOf: [],
  });
  const spoon = { id: "c1", type: "fuzzy", term: "de cuchara", polarity: "include", hard: false };
  const chicken = { id: "c2", type: "literal", term: "pollo", polarity: "include", hard: false };
  const noPork = { id: "c3", type: "exclusion", term: "cerdo", polarity: "exclude", hard: false };

  it("reports a long request with fewer than three constraints", () => {
    const issues = validateGoldenSet([long("R02", [spoon, chicken])], []);

    expect(issueFor(issues, { request: "R02", field: "constraints" })).toBe(true);
  });

  it("reports a long request with a single type", () => {
    const soups = [spoon, { ...spoon, id: "c2" }, { ...spoon, id: "c3" }];
    const issues = validateGoldenSet([long("R02", soups)], []);

    expect(issueFor(issues, { request: "R02", field: "constraints" })).toBe(true);
  });

  it("reports a golden set without seven long requests", () => {
    const issues = validateGoldenSet([long("R01", [spoon, chicken, noPork])], []);

    expect(issues.some((issue) => issue.request === undefined && issue.message.includes("7"))).toBe(true);
  });

  it("reports a reused request that is not a retrieval query", () => {
    const stray = { ...long("L99", [spoon, chicken, noPork]), origin: "retrieval-golden-set" };
    const issues = validateGoldenSet([stray], []);

    expect(issueFor(issues, { request: "L99", field: "origin" })).toBe(true);
  });
});

describe("decomposer golden set: validation", () => {
  it("reports every error at once", () => {
    const retrieval: RetrievalQuery[] = [{ id: "L06", text: "pollo" }];
    const request = reused("L06", "pollo");
    const unknownType = { ...reused("F01", "de cuchara"), origin: "llm-blind" };
    unknownType.constraints = [{ ...unknownType.constraints[0], type: "hypernym" }];

    const issues = validateGoldenSet([request, request, unknownType], retrieval);

    expect(issueFor(issues, { request: "L06", field: "id" })).toBe(true);
    expect(issueFor(issues, { request: "F01", field: "type" })).toBe(true);
  });
});
