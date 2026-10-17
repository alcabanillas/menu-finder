import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { Button } from '@/shared/ui/button';

const DICE_SIZE = { sm: 17, md: 18 };
// `sm` is the phone's button, under the search box; `md` is the desktop's, beside it (`PlannerScreen.jsx`, 800 px).
const PLACE = { sm: '-mt-2 @min-[800px]:hidden', md: 'hidden flex-none @min-[800px]:block' };

/** What the button needs from the choice: the form it posts to, whether a choice runs and, if a menu would be replaced, how to ask. */
export type RandomProps = { formId: string; disabled: boolean; onAsk?: () => void };

type RandomButtonProps = RandomProps & { size: 'sm' | 'md' };

// A secondary button that submits the choose form with `random`: the server picks the menu for the selected week. When the
// week has a menu, with JavaScript the question comes first (`onAsk`); without it the button posts.
/** "Elegir uno al azar". */
export function RandomButton({ size, formId, disabled, onAsk }: RandomButtonProps) {
  return (
    <div className={PLACE[size]}>
      <Button
        type="submit"
        variant="secondary"
        size={size}
        name="random"
        value="1"
        form={formId}
        disabled={disabled}
        onClick={
          onAsk
            ? (event) => {
                event.preventDefault();
                onAsk();
              }
            : undefined
        }
      >
        <PlannerIcon name="dices" size={DICE_SIZE[size]} />
        Elegir uno al azar
      </Button>
    </div>
  );
}
