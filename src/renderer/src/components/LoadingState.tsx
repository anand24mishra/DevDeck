import React from 'react'

export const LoadingState: React.FC = () => {
  return (
    <div className="loading-state-container" aria-label="Loading processes">
      <div className="skeleton-group-header">
        <div className="skeleton-box skeleton-title" />
        <div className="skeleton-box skeleton-badge" />
      </div>
      <div className="skeleton-rows">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-box skeleton-state" />
            <div className="skeleton-box skeleton-name" />
            <div className="skeleton-box skeleton-port" />
            <div className="skeleton-box skeleton-cpu" />
            <div className="skeleton-box skeleton-mem" />
            <div className="skeleton-box skeleton-uptime" />
          </div>
        ))}
      </div>
    </div>
  )
}
