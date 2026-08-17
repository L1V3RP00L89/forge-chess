import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { JournalModal } from './JournalModal'

const noop = vi.fn()

function renderJournalModal(overrides: Partial<Parameters<typeof JournalModal>[0]> = {}) {
    return renderToStaticMarkup(
        <JournalModal
            open
            promptCount={2}
            onSkip={noop}
            onSave={noop}
            {...overrides}
        />,
    )
}

describe('JournalModal', () => {
    it('renders nothing when closed', () => {
        const html = renderJournalModal({ open: false })

        expect(html).toBe('')
    })

    it('shows both prompts and both actions when open', () => {
        const html = renderJournalModal()

        expect(html).toContain('Two things that went well')
        expect(html).toContain('Two things to work on')
        expect(html).toContain('Skip')
        expect(html).toContain('Save')
    })

    it('scales down to a single prompt for blitz/bullet games', () => {
        const html = renderJournalModal({ promptCount: 1 })

        expect(html).toContain('One thing that went well')
        expect(html).toContain('One thing to work on')
        expect(html).not.toContain('Second thing that went well')
        expect(html).not.toContain('Second thing to work on')
    })
})
