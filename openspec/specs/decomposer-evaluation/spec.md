# decomposer-evaluation Specification

## Purpose

Measures the decomposer against its golden set with `pnpm ingest evaluate-decomposer`: precision and recall per constraint type, `hard` and `slot`, groups, rejections per category, failed answers and latency, for each evaluated model side by side, in `evals/decomposer/results.md`.

## Requirements

### Requirement: Inputs
The evaluation SHALL read every request of the decomposer golden set (spec `decomposer-golden-set`) with its text and its expected answer: a structure for a search request, a rejection category for a rejected request. It SHALL send the text of each request to the decomposer (spec `request-decomposer`) exactly once per model, one call after another, with no retry. A golden set that cannot be read or parsed SHALL stop the run before any call to the model.

#### Scenario: Every request, once per model
- **WHEN** the golden set has 3 requests and the run uses 2 models
- **THEN** the decomposer is called 6 times, once with the text of each request for each model

#### Scenario: Unreadable golden set
- **WHEN** the golden set cannot be read
- **THEN** the run fails naming the file, and the model is not called

### Requirement: Constraint hits
A constraint of the answer SHALL be a hit when an expected constraint of the same request has the same `term`, compared trimmed and in lowercase, the same `type` and the same `polarity`. Each expected constraint SHALL be matched to at most one constraint of the answer. Precision SHALL be the hits over the constraints of the answers, and recall the hits over the expected constraints, both summed over all the requests. They SHALL be given overall and per constraint type, with the counts behind each.

#### Scenario: Hit
- **WHEN** the expected constraint is the exclusion `cerdo` with polarity `exclude` and the answer has the exclusion `Cerdo` with polarity `exclude`
- **THEN** it is one hit

#### Scenario: Same term, other type
- **WHEN** the expected constraint is the literal `pescado` and the answer has the fuzzy `pescado`
- **THEN** it is not a hit: the answer has one constraint that misses and the request one expected constraint that is not found

#### Scenario: Shorter term
- **WHEN** the expected constraint is the fuzzy `de cuchara` and the answer has the fuzzy `cuchara`
- **THEN** it is not a hit

#### Scenario: One to one
- **WHEN** the request expects the literal `pollo` once and the answer has it twice
- **THEN** one is a hit and the other counts against precision

#### Scenario: Per type
- **WHEN** the run has 2 literal hits out of 4 literal constraints answered and 5 expected
- **THEN** the literal row has precision 0.5 and recall 0.4, with the counts 2, 4 and 5

### Requirement: Hard and slot
For the hits only, the evaluation SHALL give the share whose `hard` also matches and the share whose `slot` also matches, a missing slot matching only a missing slot.

#### Scenario: Missing slot
- **WHEN** a hit expects the slot `dinner` and the answer has no slot
- **THEN** it is a hit, and it counts as a slot mismatch

### Requirement: Groups
The evaluation SHALL score the `sameDish` groups and the `anyOf` groups in rows of their own. A group of the answer SHALL be a hit when every constraint in it is a hit and their expected constraints form a group of the same kind in the label, with no other member. Precision and recall of the groups SHALL be summed over all the requests, with their counts.

#### Scenario: Group hit
- **WHEN** the label groups the literal `arroz` and the exclusion `carne` in `sameDish`, and the answer groups its two hits for them in `sameDish`
- **THEN** it is one `sameDish` hit

#### Scenario: Group with a missed constraint
- **WHEN** the answer groups a hit with a constraint that is not a hit
- **THEN** the group is not a hit

### Requirement: Rejections
For each rejection category, the evaluation SHALL give how many rejected requests the model rejected with that category, out of how many there are. It SHALL also give the search requests the model rejected, which are a mistake, and count their expected constraints as not found.

There SHALL be one row per category of spec `request-decomposer`. A rejected trap request SHALL count as a search request rejected by mistake.

#### Scenario: Rejection hit
- **WHEN** the label of X01 is the rejection `gibberish` and the model rejects it as `gibberish`
- **THEN** the `gibberish` row counts one hit

#### Scenario: Other category
- **WHEN** the label is `instruction` and the model rejects the request as `off-topic`
- **THEN** the `instruction` row does not count it as a hit

#### Scenario: Out-of-catalog hit
- **WHEN** the label of X11 is the rejection `out-of-catalog` and the model rejects it as `out-of-catalog`
- **THEN** the `out-of-catalog` row counts one hit

#### Scenario: Search request rejected
- **WHEN** the model rejects a search request with two expected constraints
- **THEN** the request is counted as rejected by mistake and its two constraints as not found

#### Scenario: Trap request rejected
- **WHEN** the model rejects the trap request T01 as `out-of-catalog`
- **THEN** T01 is listed among the search requests rejected by mistake and its constraints count as not found

### Requirement: Failed answers
An answer the decomposer refuses (an invalid answer, a request too long) and a failed call (an API error, a timeout) SHALL count as an answer with no constraints and no rejection, SHALL be listed by request id and model, and SHALL NOT stop the run. A missing `GEMINI_API_KEY` SHALL stop the run before any call.

#### Scenario: Invalid answer
- **WHEN** the model answers one request with something that does not validate
- **THEN** the run goes on, the request id is listed as an invalid answer for that model, and its expected constraints count as not found

#### Scenario: Failed call
- **WHEN** a call times out
- **THEN** the run goes on, and the request id is listed as a failed call for that model

### Requirement: Latency
The evaluation SHALL give, for each model, the mean, the 95th percentile and the maximum time of one decomposition, measured around each call, and the ids and times of its five slowest requests. The percentile is the nearest rank: the time at position ⌈0.95 × n⌉ of the n times in ascending order.

#### Scenario: Mean and maximum
- **WHEN** the two calls of a model take 100 ms and 300 ms
- **THEN** the report gives a mean of 200 ms and a maximum of 300 ms for that model

#### Scenario: Percentile and slowest requests
- **WHEN** the 20 calls of a model take 100, 200, … 2000 ms, in the order of the golden set
- **THEN** the report gives a 95th percentile of 1900 ms, and the five slowest requests, slowest first, are the last five with 2000, 1900, 1800, 1700 and 1600 ms

### Requirement: Report
`pnpm ingest evaluate-decomposer` SHALL write the results of every model to `evals/decomposer/results.md`. The report SHALL hold the model names, the request ids and numbers only, never a term or a text. The command SHALL print, at the console, the expected constraints not found and the constraints that miss of each request, by id and model. It SHALL need `GEMINI_API_KEY` and no database. It SHALL exit with code 0 when the report is written, and with code 1, writing nothing, when the golden set cannot be read or a variable is missing. It SHALL take no argument: with one, it SHALL print the usage and exit with code 2. Every printed line SHALL pass through `redactSecrets`.

#### Scenario: Report written
- **WHEN** the run ends
- **THEN** the report is written to `evals/decomposer/results.md`, the exit code is 0, and the report holds no term of the golden set

#### Scenario: Misses at the console
- **WHEN** a request expects the literal `garbanzos` and the answer misses it
- **THEN** the console line of that request and model names `garbanzos` as not found

#### Scenario: Without a key
- **WHEN** `GEMINI_API_KEY` is not set
- **THEN** the exit code is 1, the message names the variable, nothing is written and the model is not called

#### Scenario: Unreadable golden set at the command
- **WHEN** the golden set cannot be read
- **THEN** the exit code is 1, the message names the file and nothing is written

#### Scenario: An argument
- **WHEN** the command runs with one argument
- **THEN** the usage is printed and the exit code is 2
