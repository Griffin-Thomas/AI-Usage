import { describe, expect, it, beforeEach } from 'vitest'
import { useUsageStore, useSettingsStore } from './store'
import type { UsageData } from './types'

describe('useUsageStore', () => {
  beforeEach(() => {
    useUsageStore.setState({
      usage: { claude: null, chatgpt: null, gemini: null },
      isLoading: { claude: false, chatgpt: false, gemini: false },
      error: { claude: null, chatgpt: null, gemini: null },
      lastRefresh: { claude: null, chatgpt: null, gemini: null },
    })
  })

  it('has correct initial state', () => {
    const state = useUsageStore.getState()
    expect(state.usage.claude).toBeNull()
    expect(state.usage.chatgpt).toBeNull()
    expect(state.isLoading.claude).toBe(false)
    expect(state.error.claude).toBeNull()
  })

  it('sets usage data for a provider', () => {
    const mockData: UsageData = {
      provider: 'claude',
      timestamp: '2025-01-15T12:00:00Z',
      limits: [
        {
          id: 'five-hour',
          label: '5-Hour Limit',
          utilization: 50,
          resetsAt: '2025-01-15T17:00:00Z',
        },
      ],
    }

    useUsageStore.getState().setUsage('claude', mockData)
    expect(useUsageStore.getState().usage.claude).toEqual(mockData)
    expect(useUsageStore.getState().usage.chatgpt).toBeNull()
  })

  it('sets loading state for a provider', () => {
    useUsageStore.getState().setLoading('claude', true)
    expect(useUsageStore.getState().isLoading.claude).toBe(true)
    expect(useUsageStore.getState().isLoading.chatgpt).toBe(false)
  })

  it('sets error for a provider', () => {
    useUsageStore.getState().setError('claude', 'Session expired')
    expect(useUsageStore.getState().error.claude).toBe('Session expired')
    expect(useUsageStore.getState().error.chatgpt).toBeNull()
  })

  it('sets last refresh time for a provider', () => {
    const now = new Date()
    useUsageStore.getState().setLastRefresh('claude', now)
    expect(useUsageStore.getState().lastRefresh.claude).toEqual(now)
    expect(useUsageStore.getState().lastRefresh.chatgpt).toBeNull()
  })

  it('clears error when set to null', () => {
    useUsageStore.getState().setError('claude', 'Some error')
    expect(useUsageStore.getState().error.claude).toBe('Some error')

    useUsageStore.getState().setError('claude', null)
    expect(useUsageStore.getState().error.claude).toBeNull()
  })
})

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {
        theme: 'system',
        language: 'en',
        launchAtStartup: false,
        refreshMode: 'adaptive',
        refreshInterval: 300,
        trayDisplayLimit: 'highest',
        globalShortcut: null,
        notifications: {
          enabled: true,
          thresholds: [50, 75, 90],
          notifyOnReset: true,
          notifyOnExpiry: true,
        },
        providers: [
          { id: 'claude', enabled: true, credentials: {} },
          { id: 'chatgpt', enabled: false, credentials: {} },
          { id: 'gemini', enabled: false, credentials: {} },
        ],
      },
      isLoading: false,
    })
  })

  it('has correct default settings', () => {
    const state = useSettingsStore.getState()
    expect(state.settings?.theme).toBe('system')
    expect(state.settings?.language).toBe('en')
    expect(state.settings?.launchAtStartup).toBe(false)
    expect(state.settings?.refreshMode).toBe('adaptive')
  })

  it('updates settings', () => {
    const newSettings = {
      ...useSettingsStore.getState().settings!,
      theme: 'dark' as const,
      launchAtStartup: true,
    }
    useSettingsStore.getState().setSettings(newSettings)

    const state = useSettingsStore.getState()
    expect(state.settings?.theme).toBe('dark')
    expect(state.settings?.launchAtStartup).toBe(true)
  })

  it('sets loading state', () => {
    expect(useSettingsStore.getState().isLoading).toBe(false)
    useSettingsStore.getState().setLoading(true)
    expect(useSettingsStore.getState().isLoading).toBe(true)
  })

  it('has notification settings with thresholds', () => {
    const state = useSettingsStore.getState()
    expect(state.settings?.notifications.enabled).toBe(true)
    expect(state.settings?.notifications.thresholds).toEqual([50, 75, 90])
  })
})
