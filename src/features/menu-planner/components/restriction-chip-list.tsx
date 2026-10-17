import { PlannerIcon } from '@/features/menu-planner/components/planner-icon';
import { describeChip, type Chip, type ChipMember } from '@/features/menu-planner/search-view';

type Tone = 'include' | 'exclude' | 'mixed';

// Ported from the design system's `ui_kits/app/RestrictionChip.jsx` (version 1791992191-0fd0). The colour of a member
// comes from its polarity only; the ochre is the background of a group that mixes both (spec menu-planner).
const CHIP =
  'inline-flex max-w-full min-h-[34px] flex-wrap items-center gap-x-2 gap-y-1 rounded-[17px] border px-3.5 py-1.5 ' +
  'text-sm leading-[1.3] font-medium';
const TONES: Record<Tone, string> = {
  include: 'border-olive-300 bg-olive-100 text-include-on-tint',
  exclude: 'border-terracotta-300 bg-terracotta-50 text-exclude-on-tint',
  mixed: 'border-ochre-300 bg-ochre-100 text-ochre-700',
};
const MEMBER_COLOURS = { include: 'text-include-on-tint', exclude: 'text-exclude-on-tint' };
const SOFT = 'underline decoration-dashed decoration-1 underline-offset-[3px]';
const SLOT = 'font-normal whitespace-nowrap text-text-muted';
const SLOT_LABELS = { lunch: 'comida', dinner: 'cena' };

type RestrictionChipListProps = { chips: Chip[]; label?: string };

/** The chips of the request, for guidance only: none is a control. They wrap into rows, and each reads whole. */
export function RestrictionChipList({ chips, label = 'Lo que has pedido' }: RestrictionChipListProps) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {chips.map((chip, index) => (
        <RestrictionChip key={index} chip={chip} />
      ))}
    </ul>
  );
}

function RestrictionChip({ chip }: { chip: Chip }) {
  const { members } = chip;
  const tone = toneOf(members);
  const sharedSlot = sharedSlotOf(members);
  const allSoft = members.every(({ hard }) => !hard);
  const mixedHardness = !allSoft && members.some(({ hard }) => !hard);
  return (
    <li className={`${CHIP} ${TONES[tone]} ${allSoft ? 'border-dashed' : 'border-solid'}`}>
      <span className="sr-only">{describeChip(chip)}</span>
      {members.map((member, index) => (
        <ChipMemberView
          key={index}
          member={member}
          separator={index > 0 ? chip.kind : null}
          coloured={tone === 'mixed'}
          soft={mixedHardness && !member.hard}
          showSlot={sharedSlot === undefined}
        />
      ))}
      {sharedSlot && (
        <span aria-hidden="true" data-slot className={SLOT}>
          · {SLOT_LABELS[sharedSlot]}
        </span>
      )}
    </li>
  );
}

type ChipMemberViewProps = {
  member: ChipMember;
  separator: Chip['kind'] | null;
  coloured: boolean;
  soft: boolean;
  showSlot: boolean;
};

function ChipMemberView({ member, separator, coloured, soft, showSlot }: ChipMemberViewProps) {
  return (
    <>
      {separator === 'anyOf' && (
        <span aria-hidden="true" data-separator="or" className="font-normal text-text-muted italic">
          o
        </span>
      )}
      {separator === 'sameDish' && (
        <span aria-hidden="true" data-separator="and" className="w-px self-stretch bg-current opacity-25" />
      )}
      <span
        aria-hidden="true"
        data-member
        className={`inline-flex min-w-0 items-baseline gap-[5px] ${coloured ? MEMBER_COLOURS[member.polarity] : ''}`}
      >
        <span className="flex-none self-center">
          <PlannerIcon name={iconOf(member)} size={14} strokeWidth={2} />
        </span>
        <span className={`wrap-anywhere ${soft ? SOFT : ''}`}>{member.term}</span>
        {showSlot && member.slot && (
          <span data-slot className={SLOT}>
            · {SLOT_LABELS[member.slot]}
          </span>
        )}
      </span>
    </>
  );
}

function toneOf(members: ChipMember[]): Tone {
  const polarities = new Set(members.map(({ polarity }) => polarity));
  return polarities.size > 1 ? 'mixed' : members[0].polarity;
}

function iconOf({ polarity, type }: ChipMember): 'plus' | 'minus' | 'sparkles' {
  if (polarity === 'exclude') return 'minus';
  return type === 'attribute' ? 'sparkles' : 'plus';
}

// The one meal every member shares, or none: with different meals each member carries its own.
function sharedSlotOf(members: ChipMember[]): ChipMember['slot'] {
  const first = members[0].slot;
  return members.every(({ slot }) => slot === first) ? first : undefined;
}
