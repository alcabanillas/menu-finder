import { AlertIcon } from '@/features/auth/components/alert-icon';

type FormAlertProps = { message: string };

/** The error box of the design system's Login mock (version 1791192451-31e6), announced by assistive technology. */
export function FormAlert({ message }: FormAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-terracotta-300 bg-terracotta-50 px-3.5 py-3 text-small text-terracotta-700"
    >
      <AlertIcon size={18} className="mt-px" />
      <span>{message}</span>
    </div>
  );
}
