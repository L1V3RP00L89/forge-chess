import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { IconClipboard } from './icons'
import type { JournalEntryInput } from '../hooks/useTrainingDb'

// Using existing styles from NewGameDialog to maintain design consistency
import './NewGameDialog.css'

type JournalModalProps = {
    open: boolean
    /** How many "went well" / "to work on" prompts to ask for — 1 for blitz/bullet games, 2 otherwise. */
    promptCount: 1 | 2
    onSkip: () => void
    onSave: (entry: JournalEntryInput) => void
}

const EMPTY_ENTRY: JournalEntryInput = {
    positive1: '',
    positive2: '',
    improve1: '',
    improve2: '',
}

function isDialogFocusableElement(element: HTMLElement): boolean {
    if (element.hasAttribute('disabled') || element.tabIndex === -1) return false

    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false

    return element.getClientRects().length > 0
}

export function JournalModal({ open, promptCount, onSkip, onSave }: JournalModalProps) {
    const [entry, setEntry] = useState<JournalEntryInput>(EMPTY_ENTRY)
    const panelRef = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const positive1Id = useId()
    const improve1Id = useId()

    useEffect(() => {
        if (open) setEntry(EMPTY_ENTRY)
    }, [open])

    const skipDialog = useCallback(() => {
        onSkip()
    }, [onSkip])

    const handleSave = () => {
        onSave(entry)
    }

    const setField = (key: keyof JournalEntryInput, value: string) => {
        setEntry(previous => ({ ...previous, [key]: value }))
    }

    useEffect(() => {
        if (!open) return

        const previouslyFocused = document.activeElement as HTMLElement | null
        const panelEl = panelRef.current
        if (!panelEl) return

        const focusableSelector = [
            'button:not([disabled])',
            '[href]',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(', ')

        const getFocusable = () =>
            Array.from(panelEl.querySelectorAll<HTMLElement>(focusableSelector))
                .filter(isDialogFocusableElement)

        const focusable = getFocusable()
        focusable[0]?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                skipDialog()
                return
            }

            if (event.key !== 'Tab') return
            const currentFocusable = getFocusable()
            if (!currentFocusable.length) return

            const first = currentFocusable[0]
            const last = currentFocusable[currentFocusable.length - 1]
            const active = document.activeElement as HTMLElement | null
            const activeIsFocusable = active ? currentFocusable.includes(active) : false

            if (event.shiftKey) {
                if (active === first || !activeIsFocusable) {
                    event.preventDefault()
                    last.focus()
                }
                return
            }

            if (active === last || !activeIsFocusable) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus?.()
            }
        }
    }, [open, skipDialog])

    if (!open) return null

    return (
        <div className="dialog-backdrop" onClick={skipDialog}>
            <div
                ref={panelRef}
                className="dialog-panel journal-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={e => e.stopPropagation()}
            >
                <header className="dialog-header">
                    <span className="dialog-icon"><IconClipboard /></span>
                    <h2 id={titleId}>Review Journal</h2>
                </header>

                <div className="dialog-body">
                    <div className="dialog-section">
                        <label className="dialog-label" htmlFor={positive1Id}>
                            {promptCount === 1 ? 'One thing that went well' : 'Two things that went well'}
                        </label>
                        <textarea
                            id={positive1Id}
                            className="input-textarea journal-field"
                            placeholder="e.g. Spotted the knight fork on move 14"
                            value={entry.positive1}
                            onChange={e => setField('positive1', e.target.value)}
                        />
                        {promptCount === 2 && (
                            <textarea
                                className="input-textarea journal-field"
                                aria-label="Second thing that went well"
                                placeholder="e.g. Stayed calm in a worse endgame"
                                value={entry.positive2}
                                onChange={e => setField('positive2', e.target.value)}
                            />
                        )}
                    </div>

                    <div className="dialog-section">
                        <label className="dialog-label" htmlFor={improve1Id}>
                            {promptCount === 1 ? 'One thing to work on' : 'Two things to work on'}
                        </label>
                        <textarea
                            id={improve1Id}
                            className="input-textarea journal-field"
                            placeholder="e.g. Missed a back-rank threat"
                            value={entry.improve1}
                            onChange={e => setField('improve1', e.target.value)}
                        />
                        {promptCount === 2 && (
                            <textarea
                                className="input-textarea journal-field"
                                aria-label="Second thing to work on"
                                placeholder="e.g. Rushed the opening moves"
                                value={entry.improve2}
                                onChange={e => setField('improve2', e.target.value)}
                            />
                        )}
                    </div>

                    <div className="dialog-actions">
                        <button type="button" className="btn-cancel" onClick={skipDialog}>Skip</button>
                        <button type="button" className="btn-start" onClick={handleSave}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
