import { useState } from 'react'

const steps = [
  {
    title: 'See what is running for your projects',
    text: 'DevDeck groups local development tools and Docker containers by project, with ports and resource use. Start a server and it will appear here.'
  },
  {
    title: 'Choose what to stop',
    text: 'Stopping always asks first. DevDeck protects system processes, other users, application bundles and its own helpers. Processes get time to finish normally.'
  },
  {
    title: 'Make the list yours',
    text: 'Use Settings to ignore tools, allow additional executable names, choose an editor and set your shortcut. Command arguments stay masked until you reveal them.'
  }
]
export function Onboarding({ onComplete }: { onComplete: () => Promise<void> }): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  return (
    <section className="onboarding" aria-label="Welcome to DevDeck">
      <div aria-live="polite">
        <h2>{steps[step].title}</h2>
        <p>{steps[step].text}</p>
      </div>
      <div className="onboarding-actions">
        <span>Step {step + 1} of 3</span>
        {step > 0 && (
          <button className="quiet-btn" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        <button
          className="state-btn"
          disabled={busy}
          onClick={() => {
            if (step < 2) setStep(step + 1)
            else {
              setBusy(true)
              void onComplete().finally(() => setBusy(false))
            }
          }}
        >
          {step < 2 ? 'Next' : 'Got it'}
        </button>
      </div>
    </section>
  )
}
