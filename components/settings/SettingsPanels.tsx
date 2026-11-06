'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBlockAction } from '@/app/actions/community'
import {
  changePasswordAction,
  deleteAccountAction,
  setAvatarAction,
  setExploreVisibleAction,
  updateProfileAction,
} from '@/app/(app)/settings/actions'
import { POST_LIMITS } from '@/config/community'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, TextareaField } from '@/components/ui/Field'
import { uploadPhoto } from '@/lib/client/upload'
import { usernameProblem } from '@/lib/profiles/username'

type Message = { tone: 'ok' | 'error'; text: string } | null

function Panel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-line bg-surface rounded-2xl border p-5 sm:p-6">
      <h2 className="text-ink text-base font-semibold">{title}</h2>
      {description && <p className="text-ink-muted mt-1 text-sm">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Status({ message }: { message: Message }) {
  if (!message) return null
  return (
    <p
      role={message.tone === 'error' ? 'alert' : 'status'}
      className={message.tone === 'error' ? 'text-negative text-sm' : 'text-positive text-sm'}
    >
      {message.text}
    </p>
  )
}

export function ProfilePanel({
  displayName: initialName,
  username: initialUsername,
  bio: initialBio,
  avatarMediaId,
}: {
  displayName: string
  username: string
  bio: string
  avatarMediaId: string | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(initialName)
  const [username, setUsername] = useState(initialUsername)
  const [bio, setBio] = useState(initialBio)
  const [message, setMessage] = useState<Message>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const problem = username ? usernameProblem(username) : null

  const save = () =>
    startTransition(async () => {
      const result = await updateProfileAction({ displayName, username, bio })
      setMessage(
        result.ok ? { tone: 'ok', text: 'Profile saved.' } : { tone: 'error', text: result.error },
      )
      if (result.ok) router.refresh()
    })

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const media = await uploadPhoto(file, 'avatar')
      const result = await setAvatarAction(media.id)
      setMessage(
        result.ok ? { tone: 'ok', text: 'Photo updated.' } : { tone: 'error', text: result.error },
      )
      router.refresh()
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'The upload failed.',
      })
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = () =>
    startTransition(async () => {
      const result = await setAvatarAction(null)
      if (result.ok) router.refresh()
    })

  return (
    <Panel
      title="Profile"
      description="This is what people see on your profile and next to your posts."
    >
      <div className="flex items-center gap-4">
        <Avatar name={displayName || 'You'} mediaId={avatarMediaId} size="lg" />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            loading={uploading}
          >
            {avatarMediaId ? 'Change photo' : 'Add photo'}
          </Button>
          {avatarMediaId && (
            <Button variant="ghost" size="sm" onClick={removeAvatar}>
              Remove
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void changeAvatar(e.target.files?.[0])}
          />
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <Field
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={POST_LIMITS.displayNameLength}
        />
        <Field
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          maxLength={30}
          autoComplete="off"
          hint="Your profile lives at livinup.in/u/username. Changing it breaks old links."
          error={problem ?? undefined}
        />
        <TextareaField
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={POST_LIMITS.bioLength}
          rows={3}
          showCount
        />
        <Status message={message} />
        <Button onClick={save} loading={pending} disabled={Boolean(problem) || !displayName.trim()}>
          Save profile
        </Button>
      </div>
    </Panel>
  )
}

export function PrivacyPanel({
  exploreVisible: initial,
  blocked,
}: {
  exploreVisible: boolean
  blocked: Array<{ id: string; username: string | null; displayName: string }>
}) {
  const router = useRouter()
  const [exploreVisible, setExploreVisible] = useState(initial)
  const [message, setMessage] = useState<Message>(null)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !exploreVisible
    setExploreVisible(next)
    startTransition(async () => {
      const result = await setExploreVisibleAction(next)
      if (!result.ok) {
        setExploreVisible(!next)
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  const unblock = (id: string) =>
    startTransition(async () => {
      const result = await setBlockAction(id, false)
      if (!result.ok) setMessage({ tone: 'error', text: result.error })
      else router.refresh()
    })

  return (
    <Panel
      title="Privacy"
      description="Your wardrobe and outfits are always private. Only posts you publish are public."
    >
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="text-ink block text-sm font-medium">Show my posts in Explore</span>
          <span className="text-ink-muted block text-sm">
            When off, your posts still appear on your profile and to your followers.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={exploreVisible}
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${exploreVisible ? 'bg-accent' : 'bg-line-strong'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${exploreVisible ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
          />
          <span className="sr-only">Show my posts in Explore</span>
        </button>
      </label>

      <div className="border-line mt-6 border-t pt-5">
        <h3 className="text-ink text-sm font-medium">Blocked accounts</h3>
        {blocked.length === 0 ? (
          <p className="text-ink-muted mt-1 text-sm">You have not blocked anyone.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {blocked.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3">
                <span className="text-ink truncate text-sm">
                  {account.displayName}
                  {account.username && (
                    <span className="text-ink-subtle"> @{account.username}</span>
                  )}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => unblock(account.id)}
                  disabled={pending}
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3">
        <Status message={message} />
      </div>
    </Panel>
  )
}

export function PasswordPanel({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const result = await changePasswordAction({ current, next })
      setMessage(
        result.ok
          ? { tone: 'ok', text: 'Password changed.' }
          : { tone: 'error', text: result.error },
      )
      if (result.ok) {
        setCurrent('')
        setNext('')
      }
    })

  return (
    <Panel title="Account">
      <p className="text-ink-muted text-sm">
        Signed in as <span className="text-ink font-medium">{email}</span>
      </p>
      {hasPassword && (
        <div className="mt-5 space-y-4">
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hint="At least 10 characters."
          />
          <Status message={message} />
          <Button variant="secondary" onClick={save} loading={pending} disabled={!current || !next}>
            Change password
          </Button>
        </div>
      )}
    </Panel>
  )
}

export function DeletePanel({ username }: { username: string }) {
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const [pending, startTransition] = useTransition()

  const remove = () =>
    startTransition(async () => {
      const result = await deleteAccountAction(confirmation)
      if (result && !result.ok) setMessage({ tone: 'error', text: result.error })
    })

  return (
    <Panel title="Delete account" description="This cannot be undone.">
      <ul className="text-ink-muted list-disc space-y-1 pl-5 text-sm">
        <li>Your wardrobe, outfits and every photo you uploaded are deleted.</li>
        <li>Your posts, comments, likes and follows are removed.</li>
        <li>Your username becomes available to others.</li>
      </ul>
      <div className="mt-5 space-y-3">
        <Field
          label={`Type @${username} to confirm`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
        <Status message={message} />
        <Button
          variant="danger"
          onClick={remove}
          loading={pending}
          disabled={confirmation.replace(/^@/, '').toLowerCase() !== username.toLowerCase()}
        >
          Delete my account
        </Button>
      </div>
    </Panel>
  )
}
