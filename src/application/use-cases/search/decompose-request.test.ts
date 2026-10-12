import { describe, expect, it, vi } from 'vitest';
import type { RequestDecomposer } from '@/application/ports/request-decomposer';
import { decomposeText } from '@/application/services/search/decompose-text';
import { decomposeRequest } from '@/application/use-cases/search/decompose-request';
import { err } from '@/shared/result';

describe('decomposeRequest: delegation', () => {
  it('refuses a blank request as decomposeText does, without calling the decomposer', async () => {
    const decompose = vi.fn();
    const decomposer: RequestDecomposer = { decompose };

    const result = await decomposeRequest('   ', { decomposer });

    expect(result).toEqual(err({ kind: 'request-too-short' }));
    expect(result).toEqual(await decomposeText('   ', { decomposer }));
    expect(decompose).not.toHaveBeenCalled();
  });
});
