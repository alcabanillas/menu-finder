import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLASSIFIER_MODEL,
  createGenkitIngredientClassifier,
  GenkitIngredientClassifier,
  type ClassifierCall,
  type Generate,
} from '@/infrastructure/genkit/genkit-ingredient-classifier';
import { err, ok } from '@/shared/result';

const KEY = 'AIzaFAKE-key-for-tests';

const ANSWER = {
  items: [
    { name: 'gamba pelada', groups: ['marisco'] },
    { name: 'sal', groups: [] },
  ],
};

const recording = (text = JSON.stringify(ANSWER)) => {
  const calls: ClassifierCall[] = [];
  const generate: Generate = async (call) => {
    calls.push(call);
    return text;
  };
  return { generate, calls };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createGenkitIngredientClassifier', () => {
  it('uses gemini-3.8-flash unless another model is given', () => {
    expect(createGenkitIngredientClassifier(KEY).model).toBe('gemini-3.8-flash');
    expect(createGenkitIngredientClassifier(KEY, 'gemini-3.5-flash-lite').model).toBe('gemini-3.5-flash-lite');
  });

  it('uses low thinking unless another level is given', () => {
    expect(createGenkitIngredientClassifier(KEY).thinkingLevel).toBe('LOW');
    expect(createGenkitIngredientClassifier(KEY, 'gemini-3.5-flash-lite', 'MINIMAL').thinkingLevel).toBe('MINIMAL');
  });
});

describe('GenkitIngredientClassifier', () => {
  it('puts the ingredient names in the prompt between <ingredients> delimiters', async () => {
    const { generate, calls } = recording();

    await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada', 'sal']);

    expect(calls[0].prompt).toContain('<ingredients>');
    expect(calls[0].prompt).toContain('gamba pelada');
    expect(calls[0].prompt).toContain('</ingredients>');
  });

  it('uses gemini-3.8-flash with low thinking and no sampling parameters', async () => {
    const { generate, calls } = recording();

    await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);

    expect(CLASSIFIER_MODEL).toBe('gemini-3.8-flash');
    expect(calls[0].config.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(calls[0].config).not.toHaveProperty('temperature');
    expect(calls[0].config).not.toHaveProperty('topP');
    expect(calls[0].config).not.toHaveProperty('topK');
  });

  it('sends the answer schema as a draft-7 JSON Schema', async () => {
    const { generate, calls } = recording();

    await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);

    expect(calls[0].config.responseJsonSchema).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#',
      required: ['items'],
    });
  });

  it('calls the model once and returns the parsed answer', async () => {
    const { generate, calls } = recording();

    const result = await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada', 'sal']);

    expect(calls).toHaveLength(1);
    expect(result).toEqual(ok(ANSWER));
  });

  it('returns an answer that is not JSON as its text, for the use case to refuse', async () => {
    const { generate } = recording('Soy un modelo de lenguaje');

    const result = await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);

    expect(result).toEqual(ok('Soy un modelo de lenguaje'));
  });

  it('fails without the key when the call throws an error that contains it', async () => {
    const generate: Generate = async () => {
      throw new Error(`API key ${KEY} not valid`);
    };

    const result = await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);

    expect(result).toEqual(err({ kind: 'classifier-failed', reason: 'API key *** not valid' }));
  });

  it('fails after the timeout when the model never answers', async () => {
    vi.useFakeTimers();
    const generate: Generate = () => new Promise(() => {});

    const pending = new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(await pending).toEqual(err({ kind: 'classifier-failed', reason: 'timeout after 60000 ms' }));
  });

  it('fails on an empty answer', async () => {
    const { generate } = recording('  ');

    const result = await new GenkitIngredientClassifier(generate, KEY).classify(['gamba pelada']);

    expect(result).toEqual(err({ kind: 'classifier-failed', reason: 'empty answer' }));
  });
});
