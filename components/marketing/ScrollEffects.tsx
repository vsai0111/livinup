'use client'

import { useEffect } from 'react'

/**
 * Every scroll-driven behaviour on the landing page, in one place.
 *
 * Deliberately one component rather than a hook per effect: one
 * IntersectionObserver shared by every revealing element, and one scroll
 * listener shared by the arc. A dozen components each opening their own
 * observer and their own listener is how a marketing page ends up janking on a
 * mid-range laptop.
 *
 * Nothing here is load-bearing. The page is fully readable and fully navigable
 * if this never runs — elements start dimmed, not hidden, and the arc has a
 * sensible resting rotation in CSS.
 */
export function ScrollEffects() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cleanups: Array<() => void> = []

    /* --- Reveal on entry ------------------------------------------------- */

    const revealTargets = document.querySelectorAll<HTMLElement>('.lp-inview, .lp-reveal')

    if (reduced) {
      revealTargets.forEach((el) => {
        el.dataset.revealed = 'true'
      })
    } else {
      // Split .lp-reveal text into words once, so each can be given its own
      // transition-delay. Done here rather than in the server markup to keep
      // the delivered HTML a plain readable sentence.
      document.querySelectorAll<HTMLElement>('.lp-reveal').forEach((el) => {
        if (el.dataset.split === 'true') return
        const words = (el.textContent ?? '').split(/(\s+)/)
        el.textContent = ''
        let index = 0
        for (const word of words) {
          if (/^\s+$/.test(word)) {
            el.append(word)
            continue
          }
          const span = document.createElement('span')
          span.textContent = word
          span.style.setProperty('--w', String(index++))
          el.append(span)
        }
        el.dataset.split = 'true'
      })

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            ;(entry.target as HTMLElement).dataset.revealed = 'true'
            // One-shot: re-animating on every pass back up the page is noise.
            observer.unobserve(entry.target)
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
      )

      revealTargets.forEach((el) => observer.observe(el))
      cleanups.push(() => observer.disconnect())
    }

    /* --- The hero arc rotates with the scroll ---------------------------- */

    const stage = document.querySelector<HTMLElement>('.lp-arc-stage')

    if (stage && !reduced) {
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

    /* --- Magnetic buttons ------------------------------------------------ */

    if (!reduced && !window.matchMedia('(pointer: coarse)').matches) {
      const magnets = document.querySelectorAll<HTMLElement>('.lp-magnet')

      const onMove = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement
        const rect = el.getBoundingClientRect()
        const dx = event.clientX - (rect.left + rect.width / 2)
        const dy = event.clientY - (rect.top + rect.height / 2)
        el.style.setProperty('--mx', `${dx * 0.22}px`)
        el.style.setProperty('--my', `${dy * 0.3}px`)
      }

      const onLeave = (event: PointerEvent) => {
        const el = event.currentTarget as HTMLElement
        el.style.setProperty('--mx', '0px')
        el.style.setProperty('--my', '0px')
      }

      magnets.forEach((el) => {
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
