'use client';

import { useActionState } from 'react';
import { Button } from '@/shared/ui/button';

/** What the action answers: a message or none, whether it is a failure, and the number of the answer. */
export type RandomMenuState = {
  message: string | null;
  failed: boolean;
  attempt: number;
};

type RandomMenuFormProps = {
  action: (previous: RandomMenuState) => Promise<RandomMenuState>;
};

const INITIAL_STATE: RandomMenuState = {
  message: null,
  failed: false,
  attempt: 0,
};

/** One button that asks the server for a random menu. The form posts without JavaScript too. */
export function RandomMenuForm({ action }: RandomMenuFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form
      action={formAction}
      className="flex w-full flex-col items-center gap-4"
    >
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Eligiendo…' : 'Elegir un menú al azar'}
      </Button>
      {/* A new element on every answer (`attempt`), so a repeated message is announced again. */}
      {state.message && (
        <p
          key={state.attempt}
          role={state.failed ? 'alert' : 'status'}
          className={state.failed ? 'text-center text-terracotta-700' : 'text-center text-text-strong'}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
