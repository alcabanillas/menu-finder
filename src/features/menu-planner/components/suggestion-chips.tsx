import { CHIP, RandomChip, type RandomProps } from '@/features/menu-planner/components/random-chip';

type SuggestionChipsProps = {
  suggestions: string[];
  formAction: (formData: FormData) => void;
  /** Runs when a suggestion is sent, like the search form's own submit. */
  onSent: () => void;
  random: RandomProps;
};

// "Al azar" first, then the requests. Each request is a form of its own with one submit button named `request`, so it
// posts in the body, works without JavaScript and reaches the search action as a typed request does.
/** The chips of "Prueba con" and of the suggestions of a search with no menu. */
export function SuggestionChips({ suggestions, formAction, onSent, random }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <RandomChip {...random} />
      {suggestions.map((request) => (
        <form key={request} action={formAction} onSubmit={onSent} className="m-0">
          <button type="submit" name="request" value={request} className={`${CHIP} border-border-strong font-medium`}>
            {request}
          </button>
        </form>
      ))}
    </div>
  );
}
