'use client'

import { useEffect, useRef } from 'react'

/**
 * Custom cursor.
 *
 * A single blend-mode dot that swells over anything interactive. Position is
 * written straight to the element's transform inside a rAF loop, never through
 * React state — a setState per mousemove would re-render the tree at pointer
 * frequency for something that is pure decoration.
 *
 * It augments the real cursor rather than replacing it: the native pointer is
 * left visible, so nothing is lost if this never runs.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = ref.current
    if (!dot) return

    // Touch and reduced-motion users get nothing to follow, and nothing to pay for.
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let targetX = 0
    let targetY = 0
    let x = 0
    let y = 0
    let frame = 0

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      dot.dataset.active = 'true'

      const interactive = (event.target as Element | null)?.closest(
        'a, button, [role="button"], input, select, summary',
      )
      dot.dataset.hover = interactive ? 'true' : 'false'
    }

    const onLeave = () => {
      dot.dataset.active = 'false'
    }

    const tick = () => {
      // Exponential smoothing: the dot trails the pointer slightly, which is
      // what makes it read as a physical object rather than a repositioned div.
      x += (targetX - x) * 0.18
      y += (targetY - y) * 0.18
      dot.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <div ref={ref} className="lp-cursor" aria-hidden="true" />
}
