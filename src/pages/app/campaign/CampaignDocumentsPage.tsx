import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignDocuments, useCampaignMembers } from '../../../campaigns/hooks'
import { createDocument } from '../../../campaigns/campaignsApi'
import { DOCUMENT_TYPE_LABELS } from '../../../campaigns/types'
import type { DocumentInput } from '../../../campaigns/types'
import { VISIBILITY_BADGES } from '../../../documents/visibility'
import { errorMessage } from '../../../lib/errors'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { Card } from '../../../components/ui/Card'
import { DocumentForm } from './DocumentForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './entryList.css'

export function CampaignDocumentsPage() {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { documents, loading, error } = useCampaignDocuments(campaign.id)
  const { members } = useCampaignMembers(campaign.id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canWriteSecrets = role !== 'player'
  const nameByUserId = new Map(members.map((member) => [member.userId, member.name]))

  function handleSubmit(input: DocumentInput) {
    setActionError(null)
    setBusy(true)

    createDocument(campaign.id, input)
      // Creating a document means opening it: there is nothing to see in a list
      // row for a document with no body yet.
      .then((documentId) => navigate(documentId))
      .catch((caught: unknown) => {
        setActionError(errorMessage(caught, 'Could not create that document.'))
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="entry-section">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <Card>
        <h2 className="section-title">New document</h2>
        <DocumentForm
          submitLabel="Create and open"
          busy={busy}
          canWriteSecrets={canWriteSecrets}
          onSubmit={handleSubmit}
        />
      </Card>

      <Card>
        <h2 className="section-title">Documents</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="entry-status">Loading documents…</p> : null}

        {!loading && !error && documents.length === 0 ? (
          <p className="entry-status">No documents yet. Start one above.</p>
        ) : null}

        <ul className="entry-list">
          {documents.map((document) => {
            const badge = VISIBILITY_BADGES[document.visibility]
            const isMine = document.authorId === user?.id

            return (
              <li className="entry" key={document.id}>
                <div className="entry__heading">
                  <div>
                    <h3 className="entry__title">
                      <Link to={document.id}>{document.title}</Link>
                      {/*
                        Only ever a badge on something the reader can already
                        see. There is no "2 hidden" line anywhere in this list,
                        because a count of documents you cannot open still tells
                        you they exist.
                      */}
                      {badge ? <span className="entry__badge">{badge}</span> : null}
                    </h3>
                    <p className="entry__meta">
                      {DOCUMENT_TYPE_LABELS[document.docType]} ·{' '}
                      {isMine ? 'You' : (nameByUserId.get(document.authorId) ?? 'Unknown author')} ·
                      Edited {formatDate(document.updatedAt)}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
