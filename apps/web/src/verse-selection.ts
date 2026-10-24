import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toggleVerse, type BibleSelection } from "domain/core";

/** Movement cancels a press, including undoing a hold that later became a drag. */
export function usePressActivation() {
  const press = useRef<{ id: number; x: number; y: number; threshold: number; timer: ReturnType<typeof setTimeout>; undo?: () => void } | null>(null);
  const suppress = useRef(false);
  const cancel = () => {
    if (press.current) { clearTimeout(press.current.timer); press.current.undo?.(); press.current = null; suppress.current = true; }
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > p.threshold) cancel();
    };
    const up = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel, true);
    return () => {
      if (press.current) clearTimeout(press.current.timer);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel, true);
    };
  }, []);
  function bind(activate: () => void, undo: () => void, longOnly = false) {
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button > 0 || e.isPrimary === false || (e.target as Element).closest("a,button")) return;
        cancel(); suppress.current = false;
        const p = { id: e.pointerId, x: e.clientX, y: e.clientY, threshold: e.pointerType === "mouse" ? 6 : 10,
          timer: setTimeout(() => { activate(); p.undo = undo; suppress.current = true; }, 350), undo: undefined as (() => void) | undefined };
        press.current = p;
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        if ((e.target as Element).closest("a,button")) return;
        if (suppress.current) { suppress.current = false; e.preventDefault(); return; }
        if (!longOnly) activate();
      },
      onContextMenu: (e: React.MouseEvent<HTMLElement>) => e.preventDefault(),
    };
  }
  return { bind, cancel };
}

export function useVerseSelection(initial: BibleSelection | null = null) {
  const [selection, setSelection] = useState(initial);
  const press = usePressActivation();
  function bind(context: Pick<BibleSelection, "book" | "chapter" | "version">, number: number) {
    const toggle = () => setSelection(current => toggleVerse(current, context, number));
    return {
      ...press.bind(toggle, () => setSelection(selection)),
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape") { event.preventDefault(); setSelection(null); }
        if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(); }
      },
    };
  }
  return { selection, setSelection, bind, cancel: press.cancel };
}

export function useReadingSurface() {
  useEffect(() => {
    document.documentElement.classList.add("verse-selection-surface");
    return () => document.documentElement.classList.remove("verse-selection-surface");
  }, []);
}
