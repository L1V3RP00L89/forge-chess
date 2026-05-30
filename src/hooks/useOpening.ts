import { useEffect, useMemo, useState } from 'react'

export type OpeningInfo = {
    eco: string
    name: string
}

let openingMapPromise: Promise<Record<string, OpeningInfo>> | null = null

function loadOpeningMap(): Promise<Record<string, OpeningInfo>> {
    openingMapPromise ??= import('../assets/eco.json').then(module => module.default as Record<string, OpeningInfo>)
    return openingMapPromise
}

export function useOpening(fens: string[]): OpeningInfo | undefined {
    const [map, setMap] = useState<Record<string, OpeningInfo> | null>(null)

    useEffect(() => {
        let cancelled = false
        void loadOpeningMap().then(loadedMap => {
            if (!cancelled) setMap(loadedMap)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return useMemo(() => {
        if (!map) return undefined
        // Search backwards from the most recent position so we get the deepest matching opening
        for (let i = fens.length - 1; i >= 0; i--) {
            const fen = fens[i]
            if (!fen) continue
            const key = fen.split(' ').slice(0, 4).join(' ')
            if (map[key]) {
                return map[key]
            }
        }
        return undefined
    }, [fens, map])
}
