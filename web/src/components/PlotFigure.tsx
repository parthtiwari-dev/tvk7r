import { useEffect, useRef, useState } from 'react'

/**
 * Observable Plot is not a React library: it builds a finished SVG element. This box measures
 * its own width, asks `make` for a chart of that width, and swaps it in. It redraws when the
 * width or the chart's inputs change.
 */
export function PlotFigure({ make, deps }: { make: (width: number) => Element; deps: unknown[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = box.current!
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!width) return
    const chart = make(width)
    box.current!.replaceChildren(chart)
    return () => chart.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, ...deps])

  return <div ref={box} className="plot" />
}
