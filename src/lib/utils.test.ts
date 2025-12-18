import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  formatPercentage,
  getUsageColor,
  getUsageColorHex,
  formatTimeUntil,
} from './utils'

describe('formatPercentage', () => {
  it('rounds to nearest integer', () => {
    expect(formatPercentage(50.4)).toBe('50%')
    expect(formatPercentage(50.5)).toBe('51%')
    expect(formatPercentage(50.9)).toBe('51%')
  })

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0%')
  })

  it('handles 100', () => {
    expect(formatPercentage(100)).toBe('100%')
  })

  it('handles values over 100', () => {
    expect(formatPercentage(150)).toBe('150%')
  })
})

describe('getUsageColor', () => {
  it('returns low color for usage under 50%', () => {
    expect(getUsageColor(0)).toBe('text-usage-low')
    expect(getUsageColor(25)).toBe('text-usage-low')
    expect(getUsageColor(49)).toBe('text-usage-low')
  })

  it('returns medium color for usage between 50-74%', () => {
    expect(getUsageColor(50)).toBe('text-usage-medium')
    expect(getUsageColor(60)).toBe('text-usage-medium')
    expect(getUsageColor(74)).toBe('text-usage-medium')
  })

  it('returns high color for usage 75% and above', () => {
    expect(getUsageColor(75)).toBe('text-usage-high')
    expect(getUsageColor(90)).toBe('text-usage-high')
    expect(getUsageColor(100)).toBe('text-usage-high')
  })
})

describe('getUsageColorHex', () => {
  it('returns green for usage under 50%', () => {
    expect(getUsageColorHex(0)).toBe('#22c55e')
    expect(getUsageColorHex(49)).toBe('#22c55e')
  })

  it('returns yellow for usage between 50-74%', () => {
    expect(getUsageColorHex(50)).toBe('#eab308')
    expect(getUsageColorHex(74)).toBe('#eab308')
  })

  it('returns red for usage 75% and above', () => {
    expect(getUsageColorHex(75)).toBe('#ef4444')
    expect(getUsageColorHex(100)).toBe('#ef4444')
  })
})

describe('formatTimeUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Now" for past dates', () => {
    expect(formatTimeUntil('2025-01-15T11:00:00Z')).toBe('Now')
    expect(formatTimeUntil('2024-01-01T00:00:00Z')).toBe('Now')
  })

  it('formats minutes only when less than an hour', () => {
    expect(formatTimeUntil('2025-01-15T12:30:00Z')).toBe('30m')
    expect(formatTimeUntil('2025-01-15T12:45:00Z')).toBe('45m')
  })

  it('formats hours and minutes when less than a day', () => {
    expect(formatTimeUntil('2025-01-15T14:30:00Z')).toBe('2h 30m')
    expect(formatTimeUntil('2025-01-15T23:00:00Z')).toBe('11h 0m')
  })

  it('formats days, hours, and minutes for longer durations', () => {
    expect(formatTimeUntil('2025-01-17T14:30:00Z')).toBe('2d 2h 30m')
    expect(formatTimeUntil('2025-01-22T12:00:00Z')).toBe('7d 0h 0m')
  })
})
