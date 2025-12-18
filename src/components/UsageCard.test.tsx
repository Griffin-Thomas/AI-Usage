import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageCard } from './UsageCard'
import type { UsageLimit } from '@/lib/types'

describe('UsageCard', () => {
  const mockLimit: UsageLimit = {
    id: 'five-hour',
    label: '5-Hour Limit',
    utilization: 65,
    resetsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the limit label', () => {
    const limit: UsageLimit = {
      ...mockLimit,
      resetsAt: '2025-01-15T14:00:00Z', // 2 hours from mock time
    }
    render(<UsageCard limit={limit} />)
    expect(screen.getByText('5-Hour Limit')).toBeInTheDocument()
  })

  it('renders the progress ring with correct percentage', () => {
    const limit: UsageLimit = {
      ...mockLimit,
      resetsAt: '2025-01-15T14:00:00Z',
    }
    render(<UsageCard limit={limit} />)
    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('shows reset time in full mode', () => {
    const limit: UsageLimit = {
      ...mockLimit,
      resetsAt: '2025-01-15T14:00:00Z', // 2 hours from mock time
    }
    render(<UsageCard limit={limit} />)
    expect(screen.getByText(/Resets in/)).toBeInTheDocument()
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument()
  })

  it('renders in compact mode', () => {
    const limit: UsageLimit = {
      ...mockLimit,
      resetsAt: '2025-01-15T14:00:00Z',
    }
    render(<UsageCard limit={limit} compact />)
    expect(screen.getByText('5-Hour Limit')).toBeInTheDocument()
    // Compact mode shows percentage twice: in ring and as text
    const percentages = screen.getAllByText('65%')
    expect(percentages.length).toBe(2)
    // Compact mode doesn't have "Resets in" prefix
    expect(screen.queryByText(/Resets in/)).not.toBeInTheDocument()
  })

  it('displays rounded utilization percentage', () => {
    const limit: UsageLimit = {
      ...mockLimit,
      utilization: 65.7,
      resetsAt: '2025-01-15T14:00:00Z',
    }
    render(<UsageCard limit={limit} compact />)
    // Compact mode shows percentage twice: in ring and as text
    const percentages = screen.getAllByText('66%')
    expect(percentages.length).toBe(2)
  })
})
