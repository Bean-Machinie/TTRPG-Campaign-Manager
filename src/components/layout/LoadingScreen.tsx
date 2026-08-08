import './LoadingScreen.css'

/** Shown while the persisted Supabase session is being restored. */
export function LoadingScreen() {
  return (
    <div className="loading-screen" role="status">
      Loading…
    </div>
  )
}
