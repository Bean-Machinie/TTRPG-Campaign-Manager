import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import { flattenGroups } from './slashItems'
import type { SlashGroup, SlashItem } from './slashItems'

/**
 * The `/` command list.
 *
 * Keyboard first: the mouse never has to be involved, and the highlighted item
 * is always the one Enter will insert. Tiptap's suggestion plugin owns Escape
 * and the lifecycle; this component owns the list and the selection.
 */

export type SlashMenuHandle = {
  /** Returns true when the key was consumed, which stops the editor seeing it. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

export type SlashMenuProps = {
  groups: SlashGroup[]
  query: string
  onSelect: (item: SlashItem) => void
  ref?: Ref<SlashMenuHandle>
}

export function SlashMenu({ groups, query, onSelect, ref }: SlashMenuProps) {
  const items = flattenGroups(groups)
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Filtering changes what is on screen, so the highlight goes back to the top
  // rather than staying on whichever row happens to be at the old index.
  useEffect(() => setSelected(0), [query])

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-selected="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false

      if (event.key === 'ArrowDown') {
        setSelected((current) => (current + 1) % items.length)
        return true
      }

      if (event.key === 'ArrowUp') {
        setSelected((current) => (current - 1 + items.length) % items.length)
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        onSelect(items[selected])
        return true
      }

      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="slash-menu">
        <p className="slash-menu__empty">
          Nothing matches <strong>{query}</strong>.
          <span className="slash-menu__hint">
            Keep typing to search, or press Escape to write it as text.
          </span>
        </p>
      </div>
    )
  }

  let index = -1

  return (
    <div className="slash-menu" ref={listRef} role="listbox" aria-label="Insert a block">
      {groups.map((group) => (
        <div className="slash-menu__group" key={group.name}>
          <p className="slash-menu__group-name">{group.name}</p>

          {group.items.map((item) => {
            index += 1
            const isSelected = index === selected
            // Captured because `index` keeps moving as the map continues.
            const itemIndex = index

            return (
              <button
                type="button"
                className="slash-menu__item"
                key={item.title}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected}
                // Hovering moves the highlight, so mouse and keyboard never
                // disagree about what Enter would insert.
                onMouseEnter={() => setSelected(itemIndex)}
                // The editor must not lose the selection the command acts on.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(item)}
              >
                <span className="slash-menu__title">{item.title}</span>
                <span className="slash-menu__description">{item.description}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
