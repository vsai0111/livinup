/** Image URLs. Safe to import from client components. */

export type MediaSizeName = 'sm' | 'md' | 'lg'

/** Every image is served through /media, which checks access before sending bytes. */
export function mediaUrl(id: string, size: MediaSizeName = 'md'): string {
  return `/media/${id}/${size}`
}
