import { useEffect, useRef, type RefObject } from 'react'
/** Keyboard containment and focus restoration shared by app dialogs. */
export function useDialogFocus(
  root: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open || !root.current) return
    const dialog = root.current,
      previous = document.activeElement as HTMLElement | null
    const controls = (): HTMLElement[] =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]'
        )
      ].filter((el) => el.getClientRects().length > 0)
    const focus = (): void =>
      (
        dialog.querySelector<HTMLElement>('[data-dialog-initial]') ||
        controls()[0] ||
        dialog
      ).focus()
    focus()
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = controls(),
        first = items[0],
        last = items.at(-1)
      if (!first) {
        event.preventDefault()
        dialog.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    const contain = (event: FocusEvent): void => {
      if (!dialog.contains(event.target as Node)) focus()
    }
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', contain)
    return () => {
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', contain)
      if (previous?.isConnected) previous.focus()
    }
  }, [root, open])
}
