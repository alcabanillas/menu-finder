import { googleAI } from '@genkit-ai/google-genai';
import { genkit, type Genkit, type ModelArgument } from 'genkit';
import { z } from 'zod';
import {
  ingredientClassificationSchema,
  type IngredientClassifier,
  type IngredientClassifierError,
} from '@/application/ports/ingredient-classifier';
import { ingredientClassifierPrompt } from '@/infrastructure/genkit/ingredient-classifier-prompt';
import { configureGenkitTelemetry } from '@/infrastructure/genkit/genkit-telemetry';
import { redactSecrets } from '@/shared/redact-secrets';
import { err, ok, type Result } from '@/shared/result';

export const CLASSIFIER_MODEL = 'gemini-3.8-flash';
export type ThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
const CLASSIFIER_THINKING: ThinkingLevel = 'LOW';
const TIMEOUT_MS = 60_000;

const RESPONSE_JSON_SCHEMA = z.toJSONSchema(ingredientClassificationSchema, { target: 'draft-7' });

type ClassifierConfig = {
  thinkingConfig: { thinkingLevel: ThinkingLevel };
  responseJsonSchema: Record<string, unknown>;
};

export type ClassifierCall = { prompt: string; config: ClassifierConfig };
export type Generate = (call: ClassifierCall) => Promise<string>;

/**
 * Classifies ingredient names into food groups via Gemini through Genkit.
 * Returns parsed output without validation; validation is done in the use case.
 */
export class GenkitIngredientClassifier implements IngredientClassifier {
  constructor(
    private readonly generate: Generate,
    private readonly apiKey: string,
    readonly model: string = CLASSIFIER_MODEL,
    readonly thinkingLevel: ThinkingLevel = CLASSIFIER_THINKING,
  ) {}

  async classify(ingredientNames: string[]): Promise<Result<unknown, IngredientClassifierError>> {
    try {
      const text = await withTimeout(this.generate(toCall(ingredientNames, this.thinkingLevel)));
      if (text.trim() === '') return failed('empty answer');
      return ok(parsed(text));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failed(redactSecrets(message, [this.apiKey]));
    }
  }
}

/** Creates an ingredient classifier wired to Genkit and Google AI. */
export function createGenkitIngredientClassifier(
  apiKey: string,
  model = CLASSIFIER_MODEL,
  thinkingLevel: ThinkingLevel = CLASSIFIER_THINKING,
): GenkitIngredientClassifier {
  configureGenkitTelemetry();
  const ai = genkit({ plugins: [googleAI({ apiKey })] });
  return new GenkitIngredientClassifier(genkitGenerate(ai, googleAI.model(model)), apiKey, model, thinkingLevel);
}

/** Wraps Genkit's generate method into the Generate signature required by GenkitIngredientClassifier. */
function genkitGenerate(ai: Genkit, model: ModelArgument): Generate {
  return async ({ prompt, config }) => {
    const response = await ai.generate({ model, prompt, config, output: { format: 'json', constrained: false } });
    return response.text;
  };
}

function toCall(ingredientNames: string[], thinkingLevel: ThinkingLevel): ClassifierCall {
  return {
    prompt: ingredientClassifierPrompt(ingredientNames),
    config: { thinkingConfig: { thinkingLevel }, responseJsonSchema: RESPONSE_JSON_SCHEMA },
  };
}

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

function failed(reason: string): Result<never, IngredientClassifierError> {
  return err({ kind: 'classifier-failed', reason });
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
