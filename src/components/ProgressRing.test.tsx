import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

describe('ProgressRing', () => {
  it('renders with percentage text', () => {
    render(<ProgressRing value={75} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<ProgressRing value={50} label="5-hour limit" />)
    expect(screen.getByText('5-hour limit')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('hides percentage when showPercentage is false', () => {
    render(<ProgressRing value={50} showPercentage={false} />)
    expect(screen.queryByText('50%')).not.toBeInTheDocument()
  })

  it('renders SVG with correct size', () => {
    const { container } = render(<ProgressRing value={50} size={200} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '200')
    expect(svg).toHaveAttribute('height', '200')
  })

  it('uses green color for low usage', () => {
    const { container } = render(<ProgressRing value={25} />)
    const progressCircle = container.querySelectorAll('circle')[1]
    expect(progressCircle).toHaveAttribute('stroke', '#22c55e')
  })

  it('uses yellow color for medium usage', () => {
    const { container } = render(<ProgressRing value={60} />)
    const progressCircle = container.querySelectorAll('circle')[1]
    expect(progressCircle).toHaveAttribute('stroke', '#eab308')
  })

  it('uses red color for high usage', () => {
    const { container } = render(<ProgressRing value={90} />)
    const progressCircle = container.querySelectorAll('circle')[1]
    expect(progressCircle).toHaveAttribute('stroke', '#ef4444')
  })

  it('applies custom className', () => {
    const { container } = render(<ProgressRing value={50} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
