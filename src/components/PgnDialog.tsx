import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { GameNode } from '../hooks/useGameTree'
import type { EvalSnapshot } from '../engine/analysis'
import { exportAnnotatedPgn } from '../engine/pgn'
import { buildFenShareUrl } from '../engine/shareLink'
import { IconDownload, IconClipboard, IconUpload } from './icons'

// Using existing styles from NewGameDialog to maintain design consistency
import './NewGameDialog.css'

type PgnDialogProps = {
    open: boolean
    onClose: () => void
    onImport: (pgn: string) => ImportResult
    onLoadFen: (fen: string) => ImportResult
    currentFen: string
    mainLineNodes: GameNode[]
    evaluations: Map<string, EvalSnapshot>
}

type ImportResult = {
    ok: boolean
    error?: string
}

type CopyStatus = 'idle' | 'fen-copied' | 'link-copied' | 'pgn-copied' | 'failed'

export function PgnDialog({ open, onClose, onImport, onLoadFen, currentFen, mainLineNodes, evaluations }: PgnDialogProps) {
    const [tab, setTab] = useState<'import' | 'fen' | 'export'>('import')
    const [importText, setImportText] = useState('')
    const [fenText, setFenText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
    const panelRef = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const importTextId = useId()
    const fenTextId = useId()
    const exportTextId = useId()

    const resetFeedback = useCallback(() => {
        setError(null)
        setCopyStatus('idle')
    }, [])

    const closeDialog = useCallback(() => {
        resetFeedback()
        onClose()
    }, [onClose, resetFeedback])

    const handleImport = () => {
        const result = onImport(importText)
        if (result.ok) {
            setImportText('')
            closeDialog()
            return
        }
        setError(result.error ?? 'Could not import that PGN.')
    }

    const handleLoadFen = () => {
        const result = onLoadFen(fenText)
        if (result.ok) {
            setFenText('')
            closeDialog()
            return
        }
        setError(result.error ?? 'Could not load that FEN.')
    }

    const exportText = tab === 'export' ? exportAnnotatedPgn(mainLineNodes, evaluations) : ''

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(exportText)
            setCopyStatus('pgn-copied')
        } catch {
            setCopyStatus('failed')
        }
    }

    const handleDownload = () => {
        const blob = new Blob([exportText], { type: 'application/x-chess-pgn;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `web-chess-${new Date().toISOString().slice(0, 10)}.pgn`
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
    }

    const handleUseCurrentFen = () => {
        resetFeedback()
        setFenText(currentFen)
    }

    const handleCopyCurrentFen = async () => {
        setFenText(currentFen)
        try {
            await navigator.clipboard.writeText(currentFen)
            setCopyStatus('fen-copied')
        } catch {
            setCopyStatus('failed')
        }
    }

    const handleCopyShareLink = async () => {
        resetFeedback()
        setFenText(currentFen)
        try {
            await navigator.clipboard.writeText(buildFenShareUrl(currentFen, window.location.href))
            setCopyStatus('link-copied')
        } catch {
            setCopyStatus('failed')
            setError('Clipboard access failed. The current FEN is in the text box.')
        }
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
                .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)

        const focusable = getFocusable()
        focusable[0]?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                closeDialog()
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
            previouslyFocused?.focus?.()
        }
    }, [closeDialog, open])

    if (!open) return null

    return (
        <div className="dialog-backdrop" onClick={closeDialog}>
            <div
                ref={panelRef}
                className="dialog-panel pgn-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={e => e.stopPropagation()}
            >
                <header className="dialog-header">
                    <span className="dialog-icon"><IconDownload /></span>
                    <h2 id={titleId}>PGN Import & Export</h2>
                </header>

                <div className="dialog-body">
                    <div className="dialog-section mode-selector" style={{ paddingBottom: '0.4rem' }}>
                        <div className="mode-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <button
                                type="button"
                                className={`mode-card ${tab === 'import' ? 'selected' : ''}`}
                                onClick={() => {
                                    resetFeedback()
                                    setTab('import')
                                }}
                                aria-pressed={tab === 'import'}
                            >
                                <span className="mode-icon"><IconClipboard /></span>
                                <strong>Import</strong>
                            </button>
                            <button
                                type="button"
                                className={`mode-card ${tab === 'fen' ? 'selected' : ''}`}
                                onClick={() => {
                                    resetFeedback()
                                    setTab('fen')
                                }}
                                aria-pressed={tab === 'fen'}
                            >
                                <span className="mode-icon"><IconDownload /></span>
                                <strong>FEN</strong>
                            </button>
                            <button
                                type="button"
                                className={`mode-card ${tab === 'export' ? 'selected' : ''}`}
                                onClick={() => {
                                    resetFeedback()
                                    setTab('export')
                                }}
                                aria-pressed={tab === 'export'}
                            >
                                <span className="mode-icon"><IconUpload /></span>
                                <strong>Export</strong>
                            </button>
                        </div>
                    </div>

                    {tab === 'import' && (
                        <div className="dialog-section">
                            <label className="dialog-label" htmlFor={importTextId}>Paste Portable Game Notation</label>
                            <textarea
                                id={importTextId}
                                className="input-textarea"
                                placeholder="[Event &quot;FIDE World Cup 2023&quot;]..."
                                value={importText}
                                onChange={e => {
                                    setImportText(e.target.value)
                                    setError(null)
                                }}
                                aria-invalid={Boolean(error)}
                            />
                            {error && <p className="dialog-error" role="alert">{error}</p>}
                            <div className="dialog-actions">
                                <button type="button" className="btn-cancel" onClick={closeDialog}>Cancel</button>
                                <button type="button" className="btn-start" onClick={handleImport} disabled={!importText.trim()}>
                                    Import Game
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'fen' && (
                        <div className="dialog-section">
                            <label className="dialog-label" htmlFor={fenTextId}>Paste Forsyth-Edwards Notation</label>
                            <div className="dialog-quick-actions">
                                <button type="button" className="btn-cancel" onClick={handleUseCurrentFen}>
                                    Use Current Position
                                </button>
                                <button type="button" className="btn-cancel" onClick={handleCopyCurrentFen}>
                                    {copyStatus === 'fen-copied' ? 'Copied FEN' : 'Copy Current FEN'}
                                </button>
                                <button type="button" className="btn-cancel" onClick={handleCopyShareLink}>
                                    <IconClipboard /> {copyStatus === 'link-copied' ? 'Copied Link' : 'Copy Share Link'}
                                </button>
                            </div>
                            <textarea
                                id={fenTextId}
                                className="input-textarea"
                                placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                                value={fenText}
                                onChange={e => {
                                    setFenText(e.target.value)
                                    setError(null)
                                    setCopyStatus('idle')
                                }}
                                aria-invalid={Boolean(error)}
                            />
                            {error && <p className="dialog-error" role="alert">{error}</p>}
                            {copyStatus === 'failed' && (
                                <p className="dialog-error" role="alert">Clipboard access failed. The current FEN is in the text box.</p>
                            )}
                            <div className="dialog-actions">
                                <button type="button" className="btn-cancel" onClick={closeDialog}>Cancel</button>
                                <button type="button" className="btn-start" onClick={handleLoadFen} disabled={!fenText.trim()}>
                                    Load Position
                                </button>
                            </div>
                        </div>
                    )}

                    {tab === 'export' && (
                        <div className="dialog-section">
                            <label className="dialog-label" htmlFor={exportTextId}>Annotated Output</label>
                            <textarea
                                id={exportTextId}
                                className="input-textarea"
                                readOnly
                                value={exportText}
                            />
                            <div className="dialog-actions">
                                <button type="button" className="btn-cancel" onClick={closeDialog}>Close</button>
                                <button type="button" className="btn-cancel" onClick={handleDownload}>
                                    Download PGN
                                </button>
                                <button type="button" className="btn-start" onClick={handleCopy}>
                                    {copyStatus === 'pgn-copied' ? 'Copied' : 'Copy PGN'}
                                </button>
                            </div>
                            {copyStatus === 'failed' && (
                                <p className="dialog-error" role="alert">Clipboard access failed. Select the text and copy it manually.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
