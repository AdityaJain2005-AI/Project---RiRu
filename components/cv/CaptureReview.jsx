import { useEffect, useState } from 'react'
import { MULTI_ANGLE_STATES } from '@/vision/multiAngle'

const REVIEW_VIEWS = [
  { key: 'frontImage', view: MULTI_ANGLE_STATES.FRONT, label: 'Front' },
  { key: 'leftImage', view: MULTI_ANGLE_STATES.LEFT, label: 'Left' },
  { key: 'rightImage', view: MULTI_ANGLE_STATES.RIGHT, label: 'Right' },
]

function CaptureReview({ session, onRetake, onContinue }) {
  const [previewUrls, setPreviewUrls] = useState({})
  const hasAllImages = REVIEW_VIEWS.every(({ key }) => Boolean(session?.[key]))

  useEffect(() => {
    const nextUrls = REVIEW_VIEWS.reduce((urls, { key }) => {
      if (session?.[key]) urls[key] = URL.createObjectURL(session[key])
      return urls
    }, {})

    setPreviewUrls(nextUrls)
    return () => Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
  }, [session, session?.frontImage, session?.leftImage, session?.rightImage])

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/20 backdrop-blur sm:p-6" aria-labelledby="capture-review-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Scan complete</p>
          <h2 id="capture-review-title" className="mt-1 text-2xl font-semibold text-white">Review your three views</h2>
        </div>
        <p className="text-sm text-slate-400">Each image is stored locally for the next scan step.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {REVIEW_VIEWS.map(({ key, view, label }) => (
          <article key={key} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            <div className="aspect-[4/3] bg-slate-950">
              {previewUrls[key] ? (
                <img src={previewUrls[key]} alt={`${label} face capture`} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Capture missing</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="font-semibold text-white">{label}</p>
              <button
                type="button"
                onClick={() => onRetake(view)}
                className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-sky-400 hover:text-white"
              >
                Retake
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-slate-400">{hasAllImages ? 'All three views are ready.' : 'Complete all three views to continue.'}</p>
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasAllImages}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          Analyze in lab
        </button>
      </div>
    </section>
  )
}

export default CaptureReview