import { describe, expect, it, beforeEach } from 'vitest'
import { useUsageStore, useSettingsStore, useAccountsStore } from './store'
import type { UsageData, Account } from './types'

describe('useUsageStore', () => {
  beforeEach(() => {
    // Reset to empty state (new multi-account structure)
    useUsageStore.setState({
      usage: {},
      isLoading: {},
      error: {},
      lastRefresh: {},
    })
  })

  it('has correct initial state (empty objects)', () => {
    const state = useUsageStore.getState()
    expect(state.usage).toEqual({})
    expect(state.isLoading).toEqual({})
    expect(state.error).toEqual({})
    expect(state.lastRefresh).toEqual({})
  })

  it('sets usage data for an account', () => {
    const mockData: UsageData = {
      provider: 'claude',
      accountId: 'account-123',
      accountName: 'Personal',
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

    useUsageStore.getState().setUsage('account-123', mockData)
    expect(useUsageStore.getState().usage['account-123']).toEqual(mockData)
  })

  it('sets loading state for an account', () => {
    useUsageStore.getState().setLoading('account-123', true)
    expect(useUsageStore.getState().isLoading['account-123']).toBe(true)
    expect(useUsageStore.getState().isLoading['account-456']).toBeUndefined()
  })

  it('sets error for an account', () => {
    useUsageStore.getState().setError('account-123', 'Session expired')
    expect(useUsageStore.getState().error['account-123']).toBe('Session expired')
  })

  it('sets last refresh time for an account', () => {
    const now = new Date()
    useUsageStore.getState().setLastRefresh('account-123', now)
    expect(useUsageStore.getState().lastRefresh['account-123']).toEqual(now)
  })

  it('clears error when set to null', () => {
    useUsageStore.getState().setError('account-123', 'Some error')
    expect(useUsageStore.getState().error['account-123']).toBe('Some error')

    useUsageStore.getState().setError('account-123', null)
    expect(useUsageStore.getState().error['account-123']).toBeNull()
  })

  it('removes an account from all state maps', () => {
    const mockData: UsageData = {
      provider: 'claude',
      accountId: 'account-123',
      accountName: 'Personal',
      timestamp: '2025-01-15T12:00:00Z',
      limits: [],
    }

    // Set up state for account
    useUsageStore.getState().setUsage('account-123', mockData)
    useUsageStore.getState().setLoading('account-123', true)
    useUsageStore.getState().setError('account-123', 'error')
    useUsageStore.getState().setLastRefresh('account-123', new Date())

    // Remove account
    useUsageStore.getState().removeAccount('account-123')

    const state = useUsageStore.getState()
    expect(state.usage['account-123']).toBeUndefined()
    expect(state.isLoading['account-123']).toBeUndefined()
    expect(state.error['account-123']).toBeUndefined()
    expect(state.lastRefresh['account-123']).toBeUndefined()
  })

  it('clears all state', () => {
    useUsageStore.getState().setUsage('account-1', { provider: 'claude', accountId: 'account-1', accountName: 'A', timestamp: '', limits: [] })
    useUsageStore.getState().setUsage('account-2', { provider: 'claude', accountId: 'account-2', accountName: 'B', timestamp: '', limits: [] })

    useUsageStore.getState().clearAll()

    const state = useUsageStore.getState()
    expect(state.usage).toEqual({})
    expect(state.isLoading).toEqual({})
  })

  it('getAllUsage returns all non-null usage data', () => {
    const mockData1: UsageData = {
      provider: 'claude',
      accountId: 'account-1',
      accountName: 'Personal',
      timestamp: '2025-01-15T12:00:00Z',
      limits: [],
    }
    const mockData2: UsageData = {
      provider: 'claude',
      accountId: 'account-2',
      accountName: 'Work',
      timestamp: '2025-01-15T12:00:00Z',
      limits: [],
    }

    useUsageStore.getState().setUsage('account-1', mockData1)
    useUsageStore.getState().setUsage('account-2', mockData2)
    useUsageStore.getState().setUsage('account-3', null)

    const allUsage = useUsageStore.getState().getAllUsage()
    expect(allUsage).toHaveLength(2)
    expect(allUsage).toContainEqual(mockData1)
    expect(allUsage).toContainEqual(mockData2)
  })
})

describe('useAccountsStore', () => {
  beforeEach(() => {
    useAccountsStore.setState({
      accounts: [],
      isLoading: false,
      error: null,
    })
  })

  it('has correct initial state', () => {
    const state = useAccountsStore.getState()
    expect(state.accounts).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('sets accounts', () => {
    const accounts: Account[] = [
      { id: '1', name: 'Personal', provider: 'claude', credentials: { org_id: 'org1' }, createdAt: '2025-01-01' },
      { id: '2', name: 'Work', provider: 'claude', credentials: { org_id: 'org2' }, createdAt: '2025-01-02' },
    ]
    useAccountsStore.getState().setAccounts(accounts)
    expect(useAccountsStore.getState().accounts).toEqual(accounts)
  })

  it('adds an account', () => {
    const account: Account = { id: '1', name: 'Personal', provider: 'claude', credentials: {}, createdAt: '2025-01-01' }
    useAccountsStore.getState().addAccount(account)
    expect(useAccountsStore.getState().accounts).toHaveLength(1)
    expect(useAccountsStore.getState().accounts[0]).toEqual(account)
  })

  it('updates an account', () => {
    const account: Account = { id: '1', name: 'Personal', provider: 'claude', credentials: {}, createdAt: '2025-01-01' }
    useAccountsStore.getState().addAccount(account)

    const updated = { ...account, name: 'Updated Name' }
    useAccountsStore.getState().updateAccount(updated)

    expect(useAccountsStore.getState().accounts[0].name).toBe('Updated Name')
  })

  it('removes an account', () => {
    const accounts: Account[] = [
      { id: '1', name: 'Personal', provider: 'claude', credentials: {}, createdAt: '2025-01-01' },
      { id: '2', name: 'Work', provider: 'claude', credentials: {}, createdAt: '2025-01-02' },
    ]
    useAccountsStore.getState().setAccounts(accounts)
    useAccountsStore.getState().removeAccount('1')

    expect(useAccountsStore.getState().accounts).toHaveLength(1)
    expect(useAccountsStore.getState().accounts[0].id).toBe('2')
  })

  it('getAccountById returns the correct account', () => {
    const accounts: Account[] = [
      { id: '1', name: 'Personal', provider: 'claude', credentials: {}, createdAt: '2025-01-01' },
      { id: '2', name: 'Work', provider: 'claude', credentials: {}, createdAt: '2025-01-02' },
    ]
    useAccountsStore.getState().setAccounts(accounts)

    expect(useAccountsStore.getState().getAccountById('1')?.name).toBe('Personal')
    expect(useAccountsStore.getState().getAccountById('2')?.name).toBe('Work')
    expect(useAccountsStore.getState().getAccountById('3')).toBeUndefined()
  })

  it('sets loading state', () => {
    useAccountsStore.getState().setLoading(true)
    expect(useAccountsStore.getState().isLoading).toBe(true)
  })

  it('sets error', () => {
    useAccountsStore.getState().setError('Failed to load')
    expect(useAccountsStore.getState().error).toBe('Failed to load')
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
          dndEnabled: false,
          dndStartTime: "22:00",
          dndEndTime: "08:00",
        },
        providers: [
          { id: 'claude', enabled: true, credentials: {} },
          { id: 'chatgpt', enabled: false, credentials: {} },
          { id: 'gemini', enabled: false, credentials: {} },
        ],
        apiServerEnabled: false,
        apiServerPort: 31415,
        apiServerToken: null,
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
