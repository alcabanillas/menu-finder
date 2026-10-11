import { googleAI } from '@genkit-ai/google-genai';
import { genkit, type Genkit, type ModelArgument } from 'genkit';
import { z } from 'zod';
import { decompositionSchema, type DecomposerFailure, type RequestDecomposer } from '@/application/ports/request-decomposer';
import { decomposerPrompt } from '@/infrastructure/genkit/decomposer-prompt';
import { redactSecrets } from '@/shared/redact-secrets';
import { err, ok, type Result } from '@/shared/result';

/** IA-proveedor (MF-40.2 design D9); MF-40.3 compares it with `gemini-3.8-flash`. */
export const DECOMPOSER_MODEL = 'gemini-3.5-flash-lite';

/** MF-40.2 design D5. */
const TIMEOUT_MS = 20_000;

/** How much the model thinks: the decomposer uses the least,  (MF-40.2 design D5). */
export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

// The schema comes from `zod` 4, the one of the use case, and not from the `z` of `genkit` (zod 3): Genkit only
// receives this JSON Schema. Draft 7, because Genkit's validator does not know Zod's default, draft 2020-12 (task 4.1).
const RESPONSE_JSON_SCHEMA = z.toJSONSchema(decompositionSchema, { target: 'draft-7' });

/**
 * The model config. No `temperature`, `topP` or `topK`: Gemini 3 ignores them (design D5). The schema goes here,
 * as Gemini's own `responseJsonSchema`, so that Genkit does not validate the answer (design D2).
 */
type DecomposerConfig = {
  thinkingConfig: { thinkingLevel: ThinkingLevel };
  responseJsonSchema: Record<string, unknown>;
};

export type DecomposerCall = { prompt: string; config: DecomposerConfig };

/** One call to the model; resolves to the text of its answer. Replaced in tests. */
export type Generate = (call: DecomposerCall) => Promise<string>;

/**
 * Sends the request to Gemini through Genkit and returns its answer parsed, or as text when it is not JSON.
 * It never validates the answer: that is the use case's job (design D2). Errors never carry the API key.
 */
export class GenkitRequestDecomposer implements RequestDecomposer {
  constructor(
    private readonly generate: Generate,
    private readonly apiKey: string,
    readonly model: string = DECOMPOSER_MODEL,
    readonly thinkingLevel: ThinkingLevel = 'MINIMAL',
  ) {}

  async decompose(request: string): Promise<Result<unknown, DecomposerFailure>> {
    try {
      const text = await withTimeout(this.generate(toCall(request, this.thinkingLevel)));
      if (text.trim() === '') return failed('empty answer');
      return ok(parsed(text));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failed(redactSecrets(message, [this.apiKey]));
    }
  }
}

/**
 * Gemini through Genkit; the key is passed in, never read by the plugin. Another model and thinking level only for
 * the evaluation of MF-40.3, which compares two models: `gemini-3.8-flash` refuses `MINIMAL` (MF-40.3 design D4).
 */
export function createGenkitRequestDecomposer(
  apiKey: string,
  model = DECOMPOSER_MODEL,
  thinkingLevel: ThinkingLevel = 'MINIMAL',
): GenkitRequestDecomposer {
  const ai = genkit({ plugins: [googleAI({ apiKey })] });
  return new GenkitRequestDecomposer(genkitGenerate(ai, googleAI.model(model)), apiKey, model, thinkingLevel);
}

/**
 * `ai.generate` in JSON mode, unconstrained: with `constrained` on, the plugin replaces `responseJsonSchema` with
 * Genkit's empty output schema, and without `format: 'json'` it sends no JSON MIME type (task 4.1).
 */
export function genkitGenerate(ai: Genkit, model: ModelArgument): Generate {
  return async ({ prompt, config }) => {
    const response = await ai.generate({ model, prompt, config, output: { format: 'json', constrained: false } });
    return response.text;
  };
}

function toCall(request: string, thinkingLevel: ThinkingLevel): DecomposerCall {
  return {
    prompt: decomposerPrompt(request),
    config: { thinkingConfig: { thinkingLevel }, responseJsonSchema: RESPONSE_JSON_SCHEMA },
  };
}

// The adapter's own timer, so that a test can check it with a call that never answers (design D5).
async function withTimeout(call: Promise<string>): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${TIMEOUT_MS} ms`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function failed(reason: string): Result<never, DecomposerFailure> {
  return err({ kind: 'decomposer-failed', reason });
}

// An answer that is not JSON goes on as its text: the use case refuses it as an invalid answer.
function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
