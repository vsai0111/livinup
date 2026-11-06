'use client'

import { useEffect } from 'react'

/**
 * The hero's two pointer/scroll effects:
 *
 *   - the card arc pivots as the page scrolls past it;
 *   - the primary button leans towards the pointer ("magnetic").
 *
 * One scroll listener, throttled to animation frames. Nothing here is
 * load-bearing: without it the arc sits at its resting angle and the buttons
 * are ordinary buttons. Both are skipped for reduced-motion users.
 */
export function ScrollEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cleanups: Array<() => void> = []

    /* --- The arc rotates with the scroll ---------------------------------- */

    const stage = document.querySelector<HTMLElement>('.lp-arc-stage')
    if (stage) {
      let ticking = false

      const update = () => {
        ticking = false
        const arc = stage.parentElement
        if (!arc) return
        const rect = arc.getBoundingClientRect()
        // Progress from "arc bottom enters the viewport" to "arc top leaves it".
        const total = window.innerHeight + rect.height
        const seen = window.innerHeight - rect.top
        const progress = Math.min(1, Math.max(0, seen / total))
        stage.style.setProperty('--arc-rotate', `${(progress - 0.5) * 26}deg`)
      }

      const onScroll = () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(update)
      }

      update()
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
      })
    }

    /* --- Magnetic buttons -------------------------------------------------- */

    if (!window.matchMedia('(pointer: coarse)').matches) {
      const onMove = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${(event.clientX - (rect.left + rect.width / 2)) * 0.22}px`)
        el.style.setProperty('--my', `${(event.clientY - (rect.top + rect.height / 2)) * 0.3}px`)
      }
      const onLeave = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement
        el.style.setProperty('--mx', '0px')
        el.style.setProperty('--my', '0px')
      }

      document.querySelectorAll<HTMLElement>('.lp-magnet').forEach((el) => {
        el.addEventListener('pointermove', onMove as EventListener)
        el.addEventListener('pointerleave', onLeave as EventListener)
        cleanups.push(() => {
          el.removeEventListener('pointermove', onMove as EventListener)
          el.removeEventListener('pointerleave', onLeave as EventListener)
        })
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return null
}
