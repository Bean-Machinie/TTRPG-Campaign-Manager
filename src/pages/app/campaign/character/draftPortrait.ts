const keyFor = (draftId: string) => `character-draft-portrait:${draftId}`

export function readDraftPortrait(draftId: string): string | null {
  try {
    return sessionStorage.getItem(keyFor(draftId))
  } catch {
    return null
  }
}

export function writeDraftPortrait(draftId: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(keyFor(draftId), value)
    else sessionStorage.removeItem(keyFor(draftId))
  } catch {
    // A preview is best-effort until persistent character portraits land.
  }
}
