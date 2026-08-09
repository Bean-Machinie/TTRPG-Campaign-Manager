import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { JSONContent } from '@tiptap/core'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignDocument } from '../../../campaigns/hooks'
import {
  deleteDocument,
  saveDocumentContent,
  updateDocument,
} from '../../../campaigns/campaignsApi'
import { DOCUMENT_TYPE_LABELS } from '../../../campaigns/types'
import type { CampaignDocument, DocumentInput } from '../../../campaigns/types'
import { VISIBILITY_BADGES, VISIBILITY_LABELS } from '../../../documents/visibility'
import { SAVE_STATUS_LABELS, useAutosave } from '../../../documents/useAutosave'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DocumentEditor } from '../../../editor/DocumentEditor'
import { withoutGmOnlyCells } from '../../../editor/documentContent'
import { DocumentForm } from './DocumentForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import type { CampaignRole } from '../../../campaigns/types'
import './entryList.css'
import './CampaignDocumentPage.css'

export function CampaignDocumentPage() {
  const { documentId } = useParams()
  const { campaign, role } = useCampaignOutlet()
  const { document, loading, error, reload } = useCampaignDocument(documentId)

  if (loading) {
    return <p className="entry-status">Loading document…</p>
  }

  if (error) {
    return <Alert>{error}</Alert>
  }

  // Missing and not-yours are the same answer on purpose. "You do not have
  // permission to view this document" confirms there is one.
  if (!document) {
    return (
      <Card>
        <h2 className="section-title">Document not found</h2>
        <p className="entry-status">
          It does not exist, or it is not shared with you.{' '}
          <Link to={`/app/campaigns/${campaign.id}/documents`}>Back to documents</Link>
        </p>
      </Card>
    )
  }

  return (
    // Remounting on id keeps the editor uncontrolled: the document is seeded
    // once and ProseMirror owns it from there.
    <LoadedDocument key={document.id} document={document} role={role} onChanged={reload} />
  )
}

type LoadedDocumentProps = {
  document: CampaignDocument
  role: CampaignRole
  onChanged: () => void
}

/**
 * Whether to show the writing affordances.
 *
 * This is not the access rule — `public.can_write_visibility()` is, and it runs
 * on every write whatever this returns. What it decides is whether to offer a
 * toolbar that would only produce failed requests.
 *
 * The `author_only` clause is unreachable today, because a document nobody else
 * may read is one nobody else can have loaded. It stays because the day someone
 * widens the read policy for GMs, this is the line that keeps their editor shut.
 */
function canEdit(document: CampaignDocument, role: CampaignRole, userId: string | undefined) {
  if (document.authorId === userId) return true
  return role !== 'player' && document.visibility !== 'author_only'
}

function LoadedDocument({ document, role, onChanged }: LoadedDocumentProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editable = canEdit(document, role, user?.id)
  const canWriteSecrets = role !== 'player'
  const badge = VISIBILITY_BADGES[document.visibility]

  const save = useCallback(
    (content: JSONContent) => saveDocumentContent(document.id, content),
    [document.id],
  )
  const { schedule, status, error: saveError } = useAutosave(save)

  function handleSettings(input: DocumentInput) {
    setActionError(null)
    setBusy(true)

    updateDocument(document.id, input)
      .then(() => {
        setSettingsOpen(false)
        onChanged()
      })
      .catch((caught: unknown) => {
        setActionError(errorMessage(caught, 'Could not save those settings.'))
      })
      .finally(() => setBusy(false))
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${document.title}"?`)) return

    setActionError(null)
    setBusy(true)

    deleteDocument(document.id)
      .then(() => navigate('..'))
      .catch((caught: unknown) => {
        setActionError(errorMessage(caught, 'Could not delete that document.'))
      })
      .finally(() => setBusy(false))
  }

  return (
    // No card, no panel. The document is the page — the app shell is the only
    // frame it gets.
    <div className="document-page">
      {actionError ? <Alert>{actionError}</Alert> : null}
      {saveError ? <Alert>{saveError}</Alert> : null}

      <header className="document-page__header">
        <div>
          <h1 className="document-page__title">
            {document.title}
            {badge ? <span className="entry__badge">{badge}</span> : null}
          </h1>
          <p className="document-page__meta">
            {DOCUMENT_TYPE_LABELS[document.docType]} · {VISIBILITY_LABELS[document.visibility]}
            {editable ? (
              <>
                {' '}
                · <span className="document-page__status">{SAVE_STATUS_LABELS[status]}</span>
              </>
            ) : null}
          </p>
        </div>

        {editable ? (
          <div className="entry__actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              {settingsOpen ? 'Close' : 'Settings'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </header>

      {settingsOpen ? (
        <Card className="document-page__settings">
          <DocumentForm
            initialValue={{
              title: document.title,
              docType: document.docType,
              visibility: document.visibility,
            }}
            submitLabel="Save settings"
            busy={busy}
            canWriteSecrets={canWriteSecrets}
            onSubmit={handleSettings}
            onCancel={() => setSettingsOpen(false)}
          />
        </Card>
      ) : null}

      <DocumentEditor
        content={role === 'player' ? withoutGmOnlyCells(document.content) : document.content}
        editable={editable}
        canWriteSecrets={canWriteSecrets}
        visibility={document.visibility}
        onChange={schedule}
      />
    </div>
  )
}
