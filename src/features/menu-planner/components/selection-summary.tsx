import type {
  CurrentSelectionsDto,
  SelectionSummaryDto,
} from '@/application/dto/selection-summary';
import { formatMonday } from '@/shared/format-monday';

type SelectionSummaryProps = { selections: CurrentSelectionsDto | null };

/** This week's menu and next week's, or a message when they could not be read (`null`). */
export function SelectionSummary({ selections }: SelectionSummaryProps) {
  if (!selections)
    return <p className="text-text-muted">No se ha podido cargar tu menú.</p>;
  return (
    <dl className="grid w-full gap-3 sm:grid-cols-2">
      <Week label="Esta semana" selection={selections.activeMenu} />
      <Week label="La semana que viene" selection={nextWeekOf(selections)} />
    </dl>
  );
}

// The shopping list is next week's only when it starts after this week's menu; otherwise it is this week's.
function nextWeekOf({
  activeMenu,
  shoppingList,
}: CurrentSelectionsDto): SelectionSummaryDto | null {
  return shoppingList && shoppingList.startsOn !== activeMenu?.startsOn
    ? shoppingList
    : null;
}

function Week({
  label,
  selection,
}: {
  label: string;
  selection: SelectionSummaryDto | null;
}) {
  return (
    <div className="rounded-md border border-border-hairline bg-surface-sunken px-4 py-3">
      <dt className="text-small text-text-muted">{label}</dt>
      <dd className="font-semibold text-text-strong">
        {selection
          ? `Menú ${selection.menuNumber} · desde el ${formatMonday(selection.startsOn)}`
          : 'Sin elegir'}
      </dd>
    </div>
  );
}
