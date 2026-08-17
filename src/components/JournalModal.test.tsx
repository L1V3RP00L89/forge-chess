import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { JournalModal } from './JournalModal'

const noop = vi.fn()

function renderJournalModal(overrides: Partial<Parameters<typeof JournalModal>[0]> = {}) {
    return renderToStaticMarkup(
        <JournalModal
            open
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
})
