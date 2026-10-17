import { Button } from '@/shared/ui/button';

/** What the confirmation posts to the choose form when the user agrees: `menu` with a number, or `random`. */
type ConfirmField = { name: 'menu' | 'random'; value: string | number };

type ConfirmChangeProps = {
  text: string;
  formId: string;
  field: ConfirmField;
  onCancel: () => void;
  className?: string;
};

// After the confirmation of the design system's `PlannerScreen.jsx` and `MenuCandidateCard.jsx` (version 1792255497-a1ff):
// an ochre box with the question and the buttons Cambiar and Cancelar. Cambiar submits the choose form, so it works
// as the choice does; Cancelar only closes the box.
/** "¿Cambiar el Menú 31 por el Menú 22 en la semana del 19 oct?" before a menu replaces the one a week has. */
export function ConfirmChange({ text, formId, field, onCancel, className = '' }: ConfirmChangeProps) {
  return (
    <div role="group" aria-label="Confirmar cambio" className={`rounded-sm bg-ochre-100 px-3.5 py-3 text-ochre-700 ${className}`}>
      <p className="m-0 text-sm leading-[1.45] font-semibold">{text}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button type="submit" size="sm" name={field.name} value={field.value} form={formId}>
          Cambiar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
