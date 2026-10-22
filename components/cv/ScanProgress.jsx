import { MULTI_ANGLE_STATES, VIEW_CAPTURE_STATES } from '@/vision/multiAngle'

const VIEW_LABELS = [
  [MULTI_ANGLE_STATES.FRONT, 'Front'],
  [MULTI_ANGLE_STATES.LEFT, 'Left'],
  [MULTI_ANGLE_STATES.RIGHT, 'Right'],
]

function ScanProgress({ requiredView, views, countdown }) {
  return (
    <div className="scan-progress" aria-live="polite">
      <div className="scan-progress-title">Face scan</div>
      <div className="scan-progress-steps">
        {VIEW_LABELS.map(([view, label]) => {
          const isCaptured = views[view]?.status === VIEW_CAPTURE_STATES.CAPTURED
          const isCurrent = requiredView === view
          return (
            <div key={view} className={`scan-progress-step${isCurrent ? ' is-current' : ''}${isCaptured ? ' is-captured' : ''}`}>
              <span className="scan-progress-dot">{isCaptured ? '✓' : isCurrent ? '●' : '○'}</span>
              <span>{label}</span>
            </div>
          )
        })}
      </div>
      {countdown !== null ? <div className="scan-countdown">{countdown}</div> : null}
    </div>
  )
}

export default ScanProgress
