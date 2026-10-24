import { useEffect, useRef, type RefObject } from "react";

export function useBiblePageGestures(container: RefObject<HTMLElement | null>, enabled: boolean, cancelSelection: () => void, navigateChapter: (offset: number) => void) {
  const callbacks = useRef({ enabled, cancelSelection, navigateChapter });
  callbacks.current = { enabled, cancelSelection, navigateChapter };
  useEffect(() => {
    let gesture: { id: number; x: number; y: number; at: number; width: number; dragging: boolean; delta: number } | null = null;
    let suppressUntil = 0;
    const down = (event: PointerEvent) => {
      gesture = null;
      if (!callbacks.current.enabled || event.button > 0 || event.isPrimary === false || !(event.target instanceof Element)) return;
      if (!container.current?.contains(event.target) || event.target.closest("a,button,input,textarea,select,[role=dialog],.selection-menu")) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), width: container.current.clientWidth || window.innerWidth, dragging: false, delta: 0 };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
      if (!gesture.dragging && (performance.now() - gesture.at >= 350 || Math.abs(y) > 12 && Math.abs(y) >= Math.abs(x))) { gesture = null; return; }
      if (Math.abs(x) < 12 || Math.abs(x) <= Math.abs(y) * 2) return;
      gesture.dragging = true; gesture.delta = x;
      callbacks.current.cancelSelection();
      event.preventDefault(); event.stopPropagation();
    };
    const up = (event: PointerEvent) => {
      const current = gesture; gesture = null;
      if (!current || current.id !== event.pointerId || !current.dragging) return;
      suppressUntil = performance.now() + 400;
      event.preventDefault(); event.stopPropagation();
      if (Math.abs(current.delta) >= Math.max(80, current.width * .25)) callbacks.current.navigateChapter(current.delta < 0 ? 1 : -1);
    };
    const cancel = () => { gesture = null; };
    const click = (event: MouseEvent) => { if (event.detail && performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); } };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, { capture: true, passive: false });
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("pointermove", move, true); document.removeEventListener("pointerup", up, true); document.removeEventListener("pointercancel", cancel, true); document.removeEventListener("click", click, true); };
  }, [container]);
}
