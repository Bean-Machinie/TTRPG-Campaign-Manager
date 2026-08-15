import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, RefObject } from 'react'
import { Check, ImagePlus, Pencil, UserRound, X } from 'lucide-react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { useAuth } from '../../auth/useAuth'
import { useGameSystems } from '../../campaigns/hooks'
import { Avatar } from '../../components/shell/Avatar'
import { initialsOf } from '../../components/shell/navigation'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Page, PageHeader } from '../../components/ui/Page'
import { Textarea } from '../../components/ui/Textarea'
import { errorMessage } from '../../lib/errors'
import { cn } from '../../lib/cn'
import { AVATAR_PRESETS } from '../../profile/avatarPresets'
import type { AvatarPreset } from '../../profile/avatarPresets'
import { BANNER_PRESETS } from '../../profile/bannerPresets'
import type { BannerPreset } from '../../profile/bannerPresets'
import {
  deleteProfileAvatar,
  updateProfile,
  uploadProfileAvatar,
} from '../../profile/profileApi'
import type { Profile } from '../../profile/profileApi'
import { notifyProfileChanged, useMyProfile } from '../../profile/hooks'
import './SettingsPage.css'

const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export function SettingsPage() {
  const { user } = useAuth()
  const { profile, loading, error } = useMyProfile(user?.id)

  return (
    <Page>
      <PageHeader
        title="Profile"
        description="Shape how you appear to the people in your campaigns."
      />

      {error ? <Alert>{error}</Alert> : null}
      {loading ? <ProfileSkeleton /> : null}
      {profile ? (
        <ProfileWorkspace
          key={profile.id + profile.avatarPath}
          profile={profile}
          onSaved={() => notifyProfileChanged(profile.id)}
        />
      ) : null}

      <div className="profile-page__footer-grid">
        <AccountCard email={user?.email ?? ''} />
        <Licences />
      </div>
    </Page>
  )
}

function ProfileWorkspace({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [headline, setHeadline] = useState(profile.headline ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarPreset, setAvatarPreset] = useState<AvatarPreset | null>(profile.avatarPreset)
  const [bannerPreset, setBannerPreset] = useState<BannerPreset>(profile.bannerPreset)
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatarPath)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const name = displayName.trim() || profile.email.split('@')[0] || 'Adventurer'
  const shownAvatarUrl = previewUrl ?? (avatarPath ? profile.avatarUrl : null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function chooseFile(file: File | undefined) {
    setFormError(null)
    setSaved(false)
    if (!file) return
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setFormError('Choose a PNG, JPEG, or WebP image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setFormError('Profile images must be 5 MB or smaller.')
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setAvatarPreset(null)
    setAvatarPath(null)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    chooseFile(event.dataTransfer.files[0])
  }

  function choosePreset(preset: AvatarPreset | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPendingFile(null)
    setAvatarPath(null)
    setAvatarPreset(preset)
    setSaved(false)
    setFormError(null)
  }

  function resetDraft() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setDisplayName(profile.displayName ?? '')
    setHeadline(profile.headline ?? '')
    setBio(profile.bio ?? '')
    setAvatarPreset(profile.avatarPreset)
    setBannerPreset(profile.bannerPreset)
    setAvatarPath(profile.avatarPath)
    setPendingFile(null)
    setPreviewUrl(null)
    setFormError(null)
    setSaved(false)
    setAvatarDialogOpen(false)
    setBannerDialogOpen(false)
  }

  function cancelEditing() {
    resetDraft()
    setEditing(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setSaved(false)
    setFormError(null)

    let uploadedPath: string | null = null
    try {
      uploadedPath = pendingFile ? await uploadProfileAvatar(profile.id, pendingFile) : avatarPath
      await updateProfile(profile.id, {
        displayName,
        headline,
        bio,
        avatarPreset,
        avatarPath: uploadedPath,
        bannerPreset,
      })

      if (profile.avatarPath && profile.avatarPath !== uploadedPath) {
        await deleteProfileAvatar(profile.avatarPath).catch(() => undefined)
      }

      setPendingFile(null)
      setAvatarPath(uploadedPath)
      setAvatarDialogOpen(false)
      setBannerDialogOpen(false)
      setEditing(false)
      setSaved(true)
      onSaved()
    } catch (caught) {
      if (uploadedPath && uploadedPath !== profile.avatarPath) {
        await deleteProfileAvatar(uploadedPath).catch(() => undefined)
      }
      setFormError(errorMessage(caught, 'Could not save your profile.'))
    } finally {
      setBusy(false)
    }
  }

  const avatar = (
    <Avatar
      initials={initialsOf(name)}
      src={shownAvatarUrl}
      preset={avatarPreset}
      size="xl"
      className="profile-hero__avatar"
    />
  )

  return (
    <>
      <section className={cn('profile-hero', editing && 'profile-hero--editing')} aria-label="Profile">
        <div className={cn('profile-hero__cover', `profile-banner--${bannerPreset}`)}>
          <div className="profile-hero__cover-art" aria-hidden="true">
            <span className="profile-hero__orb profile-hero__orb--one" />
            <span className="profile-hero__orb profile-hero__orb--two" />
            <span className="profile-hero__constellation" />
          </div>
          {editing ? (
            <button
              type="button"
              className="profile-hero__banner-action"
              onClick={() => setBannerDialogOpen(true)}
            >
              Change banner
            </button>
          ) : null}
        </div>
        <div className="profile-hero__content">
          {editing ? (
            <button
              type="button"
              className="profile-hero__avatar-slot profile-hero__avatar-slot--editable"
              aria-label="Change profile image"
              onClick={() => setAvatarDialogOpen(true)}
            >
              {avatar}
              <span className="profile-hero__avatar-action">Change</span>
            </button>
          ) : (
            <div className="profile-hero__avatar-slot">{avatar}</div>
          )}

          <div className="profile-hero__identity">
            <div className="profile-hero__title-row">
              <div>
                <h2>{name}</h2>
                <p>{headline.trim() || 'Campaign member'}</p>
              </div>
              {editing ? (
                <span className="profile-hero__editing-badge">Editing profile</span>
              ) : (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  Edit profile
                </Button>
              )}
            </div>
            <p className={cn('profile-hero__bio', !bio.trim() && 'profile-hero__bio--empty')}>
              {bio.trim() ||
                'Add a short introduction so your party knows the person behind the character.'}
            </p>
          </div>
        </div>
      </section>

      {saved && !editing ? (
        <p className="profile-save-confirmation" role="status">
          <Check aria-hidden="true" /> Your profile has been updated everywhere.
        </p>
      ) : null}

      {editing ? (
        <form className="profile-editor" onSubmit={handleSubmit}>
          {formError && !avatarDialogOpen && !bannerDialogOpen ? <Alert>{formError}</Alert> : null}

          <Card className="profile-editor__details">
            <div className="profile-section-heading">
              <span className="profile-section-heading__icon">
                <UserRound aria-hidden="true" />
              </span>
              <div>
                <h2>Profile details</h2>
                <p>Changes stay private until you save your profile.</p>
              </div>
            </div>

            <div className="profile-editor__fields">
              <Input
                autoFocus
                label="Display name"
                maxLength={60}
                placeholder="How your party knows you"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setSaved(false)
                }}
              />
              <Input
                label="Profile line"
                maxLength={100}
                placeholder="Game Master · Worldbuilder · Player"
                hint={`${headline.length}/100 characters`}
                value={headline}
                onChange={(event) => {
                  setHeadline(event.target.value)
                  setSaved(false)
                }}
              />
              <Textarea
                label="About you"
                rows={5}
                maxLength={500}
                placeholder="Tell your table a little about yourself, the games you enjoy, or the stories you like to tell."
                hint={`${bio.length}/500 characters`}
                value={bio}
                onChange={(event) => {
                  setBio(event.target.value)
                  setSaved(false)
                }}
              />
            </div>
          </Card>

          <div className="profile-editor__actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={cancelEditing}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving profile…' : 'Save profile'}
            </Button>
          </div>
        </form>
      ) : null}

      <AvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        dragActive={dragActive}
        setDragActive={setDragActive}
        pendingFile={pendingFile}
        formError={formError}
        fileInput={fileInput}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        onChoosePreset={choosePreset}
        avatarPreset={avatarPreset}
        shownAvatarUrl={shownAvatarUrl}
        name={name}
      />
      <BannerDialog
        open={bannerDialogOpen}
        onOpenChange={setBannerDialogOpen}
        value={bannerPreset}
        onChange={(preset) => {
          setBannerPreset(preset)
          setSaved(false)
        }}
      />
    </>
  )
}

type BannerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: BannerPreset
  onChange: (preset: BannerPreset) => void
}

function BannerDialog({ open, onOpenChange, value, onChange }: BannerDialogProps) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="profile-avatar-overlay"
    >
      <Modal className="profile-banner-modal">
        <Dialog aria-label="Choose a profile banner" className="profile-avatar-dialog">
          <header className="profile-avatar-dialog__header">
            <div>
              <h2>Choose a banner</h2>
              <p>Select one of the curated campaign backdrops.</p>
            </div>
            <button
              type="button"
              className="profile-avatar-dialog__close"
              aria-label="Close banner chooser"
              onClick={() => onOpenChange(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="profile-banner-grid" role="radiogroup" aria-label="Profile banners">
            {BANNER_PRESETS.map((preset) => {
              const selected = value === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={cn('profile-banner-choice', `profile-banner--${preset.key}`)}
                  onClick={() => onChange(preset.key)}
                >
                  <span className="profile-banner-choice__art" aria-hidden="true" />
                  <span className="profile-banner-choice__label">{preset.label}</span>
                  {selected ? (
                    <span className="profile-banner-choice__check">
                      <Check aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          <footer className="profile-banner-dialog__footer">
            <span>Banner uploads are disabled to keep profiles visually consistent.</span>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

type AvatarDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dragActive: boolean
  setDragActive: (active: boolean) => void
  pendingFile: File | null
  formError: string | null
  fileInput: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onChoosePreset: (preset: AvatarPreset | null) => void
  avatarPreset: AvatarPreset | null
  shownAvatarUrl: string | null
  name: string
}

function AvatarDialog({
  open,
  onOpenChange,
  dragActive,
  setDragActive,
  pendingFile,
  formError,
  fileInput,
  onFileChange,
  onDrop,
  onChoosePreset,
  avatarPreset,
  shownAvatarUrl,
  name,
}: AvatarDialogProps) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      className="profile-avatar-overlay"
    >
      <Modal className="profile-avatar-modal">
        <Dialog aria-label="Choose a profile image" className="profile-avatar-dialog">
          <header className="profile-avatar-dialog__header">
            <div>
              <h2 id="profile-avatar-title">Choose a profile image</h2>
              <p>Upload your own image or select one from the adventurer gallery.</p>
            </div>
            <button
              type="button"
              className="profile-avatar-dialog__close"
              aria-label="Close profile image chooser"
              onClick={() => onOpenChange(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          {formError ? <Alert>{formError}</Alert> : null}

          <div
            className={cn(
              'profile-avatar-dropzone',
              dragActive && 'profile-avatar-dropzone--active',
            )}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false)
            }}
            onDrop={onDrop}
          >
            <span className="profile-avatar-dropzone__icon">
              <ImagePlus aria-hidden="true" />
            </span>
            <h3>{pendingFile ? pendingFile.name : 'Upload a profile image'}</h3>
            <p>Drag and drop an image here, or browse your device.</p>
            <span className="profile-avatar-dropzone__meta">PNG, JPEG or WebP · up to 5 MB</span>
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              <ImagePlus aria-hidden="true" />
              Select image
            </Button>
            <input
              ref={fileInput}
              className="profile-upload__input"
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(',')}
              onChange={onFileChange}
              aria-label="Upload profile image"
            />
          </div>

          <div className="profile-avatar-gallery-heading">
            <div>
              <h3>Adventurer gallery</h3>
              <p>Choose a ready-made avatar. You can change it again at any time.</p>
            </div>
            <Avatar
              initials={initialsOf(name)}
              src={shownAvatarUrl}
              preset={avatarPreset}
              size="md"
              className="profile-avatar-dialog__preview"
            />
          </div>

          <fieldset className="profile-presets profile-presets--dialog">
            <legend className="profile-visually-hidden">Choose a default avatar</legend>
            <div className="profile-presets__grid">
              {AVATAR_PRESETS.map((preset) => {
                const selected = avatarPreset === preset.key && !shownAvatarUrl
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className="profile-preset"
                    aria-label={preset.label}
                    aria-pressed={selected}
                    title={preset.label}
                    onClick={() => onChoosePreset(preset.key)}
                  >
                    <Avatar initials="" preset={preset.key} size="md" />
                    {selected ? (
                      <span className="profile-preset__check">
                        <Check aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <footer className="profile-avatar-dialog__footer">
            <button
              className="profile-avatar-reset"
              type="button"
              onClick={() => onChoosePreset(null)}
            >
              Use my initials instead
            </button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

function AccountCard({ email }: { email: string }) {
  return (
    <Card>
      <h2 className="section-title">Account</h2>
      <p className="settings__hint">
        Your sign-in identity is kept separate from your public profile.
      </p>
      <div className="profile-account-email">
        <span>Email address</span>
        <strong>{email}</strong>
      </div>
    </Card>
  )
}

function Licences() {
  const { systems, error } = useGameSystems()
  const licensed = systems.filter((system) => system.definition.license)
  if (licensed.length === 0 || error) return null

  return (
    <Card>
      <h2 className="section-title">Rulesets and licences</h2>
      {licensed.map((system) => {
        const license = system.definition.license
        if (!license) return null
        return (
          <div key={system.id} className="settings__licence">
            <p>
              <strong>{system.name}</strong> · {license.name}
            </p>
            <p className="settings__hint">{license.notice}</p>
            <p className="settings__links">
              {license.sourceUrl ? (
                <a href={license.sourceUrl} target="_blank" rel="noreferrer">Official source</a>
              ) : null}
              {license.referenceUrl ? (
                <a href={license.referenceUrl} target="_blank" rel="noreferrer">Markdown reference</a>
              ) : null}
              {license.url ? (
                <a href={license.url} target="_blank" rel="noreferrer">Licence</a>
              ) : null}
            </p>
          </div>
        )
      })}
    </Card>
  )
}

function ProfileSkeleton() {
  return (
    <div className="profile-skeleton" aria-label="Loading profile">
      <span />
      <span />
      <span />
    </div>
  )
}
