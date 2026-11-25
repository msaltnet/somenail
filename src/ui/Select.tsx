import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { nextActiveIndex, type ListKey } from "./listNavigation";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Optional group heading; consecutive options with the same group are listed together. */
  group?: string;
  /** e.g. render a font option in its own typeface. Applies to the trigger too. */
  labelStyle?: CSSProperties;
};

type Props<T extends string> = {
  id: string;
  /** Accessible name. Hidden visually when the context says it (shared §6.1). */
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
};

type Placement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const GAP = 4;
const PREFERRED_HEIGHT = 320;
const MIN_HEIGHT = 160;

/**
 * Single choice among many options, drawn by the system (shared DS §6 드롭다운).
 * ARIA select-only combobox: focus stays on the trigger, the listbox follows aria-activedescendant.
 */
export function Select<T extends string>({ id, label, value, options, onChange, className }: Props<T>) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];
  const optionId = (index: number) => `${listId}-option-${index}`;

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP * 2;
    const above = rect.top - GAP * 2;
    // Open downward unless the space below is short and there is more room above.
    const up = below < Math.min(PREFERRED_HEIGHT, MIN_HEIGHT * 1.5) && above > below;
    const maxHeight = Math.max(MIN_HEIGHT, Math.min(PREFERRED_HEIGHT, up ? above : below));
    setPlacement(
      up
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + GAP, maxHeight }
        : { left: rect.left, width: rect.width, top: rect.bottom + GAP, maxHeight },
    );
  }, []);

  const openList = (index = selectedIndex) => {
    setActive(index);
    place();
    setOpen(true);
  };

  const close = (commit?: number) => {
    if (commit !== undefined && options[commit] && options[commit].value !== value) {
      onChange(options[commit].value);
    }
    setOpen(false);
  };

  // Follow the trigger while the page or the sidebar scrolls; close on outside press.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (event: Event) => {
      if (listRef.current?.contains(event.target as Node)) return;
      place();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // Keep the active option visible.
  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`);
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - GAP;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + GAP;
  });

  const matchTypeahead = (key: string): number | null => {
    const now = Date.now();
    const buffer = now - typeahead.current.time < 700 ? typeahead.current.text + key : key;
    typeahead.current = { text: buffer, time: now };
    const start = open ? active : selectedIndex;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (start + (buffer.length > 1 ? offset - 1 : offset)) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(buffer.toLocaleLowerCase())) return index;
    }
    return null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(key)) {
        event.preventDefault();
        const index = key === "Home" ? 0 : key === "End" ? options.length - 1 : selectedIndex;
        openList(index);
        return;
      }
    } else {
      if (key === "Escape") {
        // Closing the list is the whole effect; app-level Esc (e.g. deselect) must not also run.
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (key === "Enter" || key === " " || (key === "ArrowUp" && event.altKey)) {
        event.preventDefault();
        close(active);
        return;
      }
      if (key === "Tab") {
        close(active);
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(key)) {
        event.preventDefault();
        setActive(nextActiveIndex(active, key as ListKey, options.length));
        return;
      }
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && key !== " ") {
      const match = matchTypeahead(key);
      if (match === null) return;
      if (open) setActive(match);
      else if (options[match].value !== value) onChange(options[match].value);
    }
  };

  // Group consecutive options under one heading.
  const groups: { name?: string; items: { option: SelectOption<T>; index: number }[] }[] = [];
  options.forEach((option, index) => {
    const last = groups[groups.length - 1];
    if (last && last.name === option.group) last.items.push({ option, index });
    else groups.push({ name: option.group, items: [{ option, index }] });
  });

  const renderOption = ({ option, index }: { option: SelectOption<T>; index: number }) => (
    <div
      key={option.value}
      id={optionId(index)}
      role="option"
      aria-selected={option.value === value}
      className={"select__option" + (index === active ? " is-active" : "")}
      onPointerMove={() => setActive(index)}
      onClick={() => {
        close(index);
        triggerRef.current?.focus();
      }}
    >
      <span className="select__option-label" style={option.labelStyle}>{option.label}</span>
      {option.value === value && <Icon name="check" />}
    </div>
  );

  return (
    <div className={["select", className ?? ""].filter(Boolean).join(" ")}>
      <span className="visually-hidden" id={`${id}-label`}>{label}</span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className="select__trigger"
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        title={label}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="select__value" style={selected?.labelStyle}>{selected?.label}</span>
        <Icon name="chevron-down" />
      </button>
      {open && placement &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            className="select__list"
            style={{
              left: placement.left,
              width: placement.width,
              top: placement.top,
              bottom: placement.bottom,
              maxHeight: placement.maxHeight,
            }}
            onMouseDown={(event) => event.preventDefault() /* keep focus on the trigger */}
          >
            {groups.map((group, groupIndex) =>
              group.name ? (
                <div role="group" aria-labelledby={`${listId}-group-${groupIndex}`} key={group.name + groupIndex}>
                  <div className="select__group" id={`${listId}-group-${groupIndex}`} role="presentation">
                    {group.name}
                  </div>
                  {group.items.map(renderOption)}
                </div>
              ) : (
                group.items.map(renderOption)
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
