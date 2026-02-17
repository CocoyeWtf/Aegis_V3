/* Poignée de redimensionnement réutilisable / Reusable resize handle for panel splitters */

import { Separator } from 'react-resizable-panels'

export function ResizeHandle({ id }: { id?: string }) {
  return (
    <Separator
      id={id}
      className="group relative mx-1 flex w-2 items-center justify-center
                 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
    >
      {/* Indicateur grip / Grip indicator */}
      <div
        className="h-8 w-1 rounded-full transition-colors
                   bg-[var(--border-color)] group-hover:bg-[var(--color-primary)]
                   group-active:bg-[var(--color-primary)]"
      />
    </Separator>
  )
}
