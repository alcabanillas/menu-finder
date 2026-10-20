import type { MenuPreviewDto, MenuPreviewFailure } from '@/application/dto/menu-preview';
import type { Result } from '@/shared/result';

/** What the week preview shows once the menu is read: its days, or the message of a read that gave nothing. */
export type PreviewState = { status: 'ready'; preview: MenuPreviewDto } | { status: 'failed'; message: string };

const MESSAGES: Record<MenuPreviewFailure['kind'], string> = {
  'invalid-menu': 'Ese menú no existe.',
  'unknown-menu': 'Ese menú no existe.',
  failed: 'No se ha podido cargar la semana. Inténtalo de nuevo.',
};

/** The answer of `menuPreview` as the week preview shows it (spec menu-planner, "The week preview needs a session…"). */
export function toPreviewState(result: Result<MenuPreviewDto, MenuPreviewFailure>): PreviewState {
  if (!result.ok) return { status: 'failed', message: MESSAGES[result.error.kind] };
  return { status: 'ready', preview: result.value };
}
