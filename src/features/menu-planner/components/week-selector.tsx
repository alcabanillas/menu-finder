import Link from 'next/link';
import type { Week, WeekToChooseDto, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
import { ConfirmChange } from '@/features/menu-planner/components/confirm-change';
import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { formatDayMonth, formatWeekRange } from '@/shared/format-week';
import { buttonClasses } from '@/shared/ui/button';

/** The question before a random menu replaces the one the selected week has; `onCancel` closes it. */
export type Asking = { text: string; onCancel: () => void };

type WeekSelectorProps = {
  weeks: WeeksToChooseDto | null;
  selected: Week;
  onSelect: (week: Week) => void;
  /** The id of the choose form: the radios post with it, whatever their place in the page. */
  formId: string;
  choice: ChoiceState;
  asking?: Asking | null;
};

const LABELS: Record<Week, string> = { current: 'Esta semana', next: 'La que viene' };
const WEEKS: Week[] = ['current', 'next'];

const OPTION =
  'relative grid min-w-0 grid-cols-[18px_minmax(0,1fr)] gap-x-2.5 rounded-md border border-border-hairline px-3.5 py-3 ' +
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink';
const OPEN =
  'cursor-pointer bg-surface-sunken hover:border-border-strong ' +
  'has-checked:border-2 has-checked:border-olive-600 has-checked:bg-olive-50 has-checked:px-[13px] has-checked:py-[11px]';
const CLOSED = 'cursor-default border-dashed bg-surface-card';

// After `WeekTarget` of the design system's `PlannerScreen.jsx` (version 1792255497-a1ff). The radios are controlled by
// `PlannerSearch`, so the cards follow them. The helps go inside the options: "Cerrada" in a closed week and "Si eliges
// otro, lo sustituye" in the selected week when it has a menu.
/** "Eligiendo menú para": this week or next week, where the menu chosen from a card goes. */
export function WeekSelector({ weeks, selected, onSelect, formId, choice, asking = null }: WeekSelectorProps) {
  if (!weeks) return <p className="text-text-muted">No se ha podido cargar tu menú.</p>;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0 @min-[800px]:max-w-[760px]">
      <legend className="mb-2.5 p-0 text-eyebrow font-semibold tracking-[var(--text-eyebrow--letter-spacing)] text-text-muted uppercase">
        Eligiendo menú para
      </legend>
      <div className="grid grid-cols-2 gap-2.5">
        {WEEKS.map((week) => (
          <Option
            // React resets the form when its action ends, which unchecks a radio whose state did not change: a new key per
            // answer mounts the radios again, checked as `selected` says.
            key={`${week}-${choice.attempt}`}
            week={week}
            label={LABELS[week]}
            data={weeks[week]}
            checked={selected === week}
            onSelect={onSelect}
            formId={formId}
          />
        ))}
      </div>
      <Footer target={weeks[selected]} choice={choice} asking={asking} formId={formId} />
    </fieldset>
  );
}

type OptionProps = {
  week: Week;
  label: string;
  data: WeekToChooseDto;
  checked: boolean;
  onSelect: (week: Week) => void;
  formId: string;
};

function Option({ week, label, data, checked, onSelect, formId }: OptionProps) {
  const closed = data.locked;
  const muted = closed ? 'text-text-muted' : 'text-text-strong';
  return (
    <label className={`${OPTION} ${closed ? CLOSED : OPEN}`}>
      <input
        type="radio"
        name="week"
        value={week}
        form={formId}
        checked={checked}
        disabled={closed}
        onChange={() => onSelect(week)}
        className="peer absolute size-px opacity-0"
      />
      <span
        aria-hidden="true"
        className={`row-span-4 mt-px flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-text-muted bg-surface-card peer-checked:border-olive-600 peer-checked:bg-olive-600 peer-checked:after:size-1.5 peer-checked:after:rounded-full peer-checked:after:bg-white ${closed ? 'opacity-40' : ''}`}
      />
      <span className={`col-start-2 block text-sm leading-[1.3] font-semibold ${checked ? 'text-olive-700' : muted}`}>{label}</span>
      <span className="col-start-2 block text-[13px] leading-[1.35] text-text-muted">
        {formatWeekRange(data.startsOn, data.endsOn)}
      </span>
      <span
        className={`col-start-2 mt-1 block ${
          data.menuNumber === null
            ? 'text-[15px] leading-[1.3] text-text-muted'
            : 'text-[17px] leading-[1.2] font-extrabold ' + muted
        }`}
      >
        {data.menuNumber === null ? 'Sin menú' : `Menú ${data.menuNumber}`}
      </span>
      <Tag closed={closed} replaces={checked && data.menuNumber !== null} />
    </label>
  );
}

function Tag({ closed, replaces }: { closed: boolean; replaces: boolean }) {
  if (!closed && !replaces) return null;
  return (
    <span
      className={`col-start-2 mt-1.5 flex items-start gap-[5px] text-[13px] leading-[1.3] ${closed ? 'text-text-muted' : 'text-ochre-700'}`}
    >
      <span className="mt-px flex-none">
        <PlannerIcon name={closed ? 'lock' : 'repeat'} size={13} strokeWidth={2} />
      </span>
      {closed ? 'Cerrada' : 'Si eliges otro, lo sustituye'}
    </span>
  );
}

type FooterProps = { target: WeekToChooseDto; choice: ChoiceState; asking: Asking | null; formId: string };

// The question, the done line, or, when the selected week is empty, where the menu will go; nothing otherwise.
function Footer({ target, choice, asking, formId }: FooterProps) {
  if (asking) {
    return <ConfirmChange text={asking.text} formId={formId} field={{ name: 'random', value: 1 }} onCancel={asking.onCancel} />;
  }
  if (choice.status === 'chosen') return <Done choice={choice} />;
  if (target.menuNumber !== null) return null;
  return <p className="m-0 text-sm leading-[1.45] text-text-muted">El menú que elijas irá a la semana del {formatDayMonth(target.startsOn)}.</p>;
}

function Done({ choice }: { choice: Extract<ChoiceState, { status: 'chosen' }> }) {
  return (
    <p role="status" className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-olive-700">
      <PlannerIcon name="check" size={16} strokeWidth={2.2} />
      {choice.message}
      <Link href={choice.weekHref} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
        Ver semana
        <PlannerIcon name="arrow-right" size={17} />
      </Link>
    </p>
  );
}
