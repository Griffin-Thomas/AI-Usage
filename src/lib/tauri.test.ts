import { describe, expect, it, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import {
  fetchUsage,
  validateCredentials,
  getCredentials,
  saveCredentials,
  deleteCredentials,
  hasCredentials,
  getSettings,
  saveSettings,
  getSchedulerStatus,
  startScheduler,
  stopScheduler,
  setRefreshInterval,
  forceRefresh,
  queryHistory,
  getHistoryMetadata,
  getRetentionPolicy,
  setRetentionPolicy,
  cleanupHistory,
  getUsageStats,
  exportHistoryJson,
  exportHistoryCsv,
  clearHistory,
} from './tauri'
import type { UsageData, UsageHistoryEntry, HistoryMetadata, RetentionPolicy, UsageStats } from './types'
import type { AppSettings, Credentials, SchedulerStatus } from './tauri'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)

describe('Tauri API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Usage Commands
  // ============================================================================

  describe('fetchUsage', () => {
    it('calls invoke with correct command and provider', async () => {
      const mockUsageData: UsageData = {
        provider: 'claude',
        timestamp: '2025-01-15T12:00:00Z',
        limits: [
          {
            id: 'five_hour',
            label: '5-Hour Limit',
            utilization: 0.45,
            resetsAt: '2025-01-15T17:00:00Z',
          },
        ],
      }
      mockInvoke.mockResolvedValue(mockUsageData)

      const result = await fetchUsage('claude')

      expect(mockInvoke).toHaveBeenCalledWith('fetch_usage', { provider: 'claude' })
      expect(result).toEqual(mockUsageData)
    })

    it('propagates errors from invoke', async () => {
      mockInvoke.mockRejectedValue(new Error('Session expired'))

      await expect(fetchUsage('claude')).rejects.toThrow('Session expired')
    })
  })

  describe('validateCredentials', () => {
    it('validates credentials and returns true', async () => {
      mockInvoke.mockResolvedValue(true)
      const credentials: Credentials = {
        org_id: 'org-123',
        session_key: 'sk-test',
      }

      const result = await validateCredentials('claude', credentials)

      expect(mockInvoke).toHaveBeenCalledWith('validate_credentials', {
        provider: 'claude',
        credentials,
      })
      expect(result).toBe(true)
    })

    it('returns false for invalid credentials', async () => {
      mockInvoke.mockResolvedValue(false)
      const credentials: Credentials = {
        org_id: '',
        session_key: '',
      }

      const result = await validateCredentials('claude', credentials)

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // Credential Commands
  // ============================================================================

  describe('getCredentials', () => {
    it('returns credentials when they exist', async () => {
      const mockCredentials: Credentials = {
        org_id: 'org-123',
        session_key: 'sk-test',
      }
      mockInvoke.mockResolvedValue(mockCredentials)

      const result = await getCredentials('claude')

      expect(mockInvoke).toHaveBeenCalledWith('get_credentials', { provider: 'claude' })
      expect(result).toEqual(mockCredentials)
    })

    it('returns null when credentials do not exist', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await getCredentials('claude')

      expect(result).toBeNull()
    })
  })

  describe('saveCredentials', () => {
    it('saves credentials successfully', async () => {
      mockInvoke.mockResolvedValue(undefined)
      const credentials: Credentials = {
        org_id: 'org-123',
        session_key: 'sk-test',
      }

      await saveCredentials('claude', credentials)

      expect(mockInvoke).toHaveBeenCalledWith('save_credentials', {
        provider: 'claude',
        credentials,
      })
    })
  })

  describe('deleteCredentials', () => {
    it('deletes credentials successfully', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await deleteCredentials('claude')

      expect(mockInvoke).toHaveBeenCalledWith('delete_credentials', { provider: 'claude' })
    })
  })

  describe('hasCredentials', () => {
    it('returns true when credentials exist', async () => {
      mockInvoke.mockResolvedValue(true)

      const result = await hasCredentials('claude')

      expect(mockInvoke).toHaveBeenCalledWith('has_credentials', { provider: 'claude' })
      expect(result).toBe(true)
    })

    it('returns false when credentials do not exist', async () => {
      mockInvoke.mockResolvedValue(false)

      const result = await hasCredentials('claude')

      expect(result).toBe(false)
    })
  })

  // ============================================================================
  // Settings Commands
  // ============================================================================

  describe('getSettings', () => {
    it('returns app settings', async () => {
      const mockSettings: AppSettings = {
        theme: 'dark',
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
      }
      mockInvoke.mockResolvedValue(mockSettings)

      const result = await getSettings()

      expect(mockInvoke).toHaveBeenCalledWith('get_settings')
      expect(result).toEqual(mockSettings)
    })
  })

  describe('saveSettings', () => {
    it('saves settings successfully', async () => {
      mockInvoke.mockResolvedValue(undefined)
      const settings: AppSettings = {
        theme: 'dark',
        language: 'en',
        launchAtStartup: true,
        refreshMode: 'fixed',
        refreshInterval: 60,
        trayDisplayLimit: 'five_hour',
        globalShortcut: 'CommandOrControl+Shift+A',
        notifications: {
          enabled: true,
          thresholds: [50, 75, 90],
          notifyOnReset: true,
          notifyOnExpiry: true,
        },
        providers: [],
      }

      await saveSettings(settings)

      expect(mockInvoke).toHaveBeenCalledWith('save_settings', { settings })
    })
  })

  // ============================================================================
  // Scheduler Commands
  // ============================================================================

  describe('getSchedulerStatus', () => {
    it('returns scheduler status', async () => {
      const mockStatus: SchedulerStatus = {
        running: true,
        intervalSecs: 60,
        lastFetch: Date.now(),
      }
      mockInvoke.mockResolvedValue(mockStatus)

      const result = await getSchedulerStatus()

      expect(mockInvoke).toHaveBeenCalledWith('get_scheduler_status')
      expect(result).toEqual(mockStatus)
    })
  })

  describe('startScheduler', () => {
    it('starts the scheduler', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await startScheduler()

      expect(mockInvoke).toHaveBeenCalledWith('start_scheduler')
    })
  })

  describe('stopScheduler', () => {
    it('stops the scheduler', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await stopScheduler()

      expect(mockInvoke).toHaveBeenCalledWith('stop_scheduler')
    })
  })

  describe('setRefreshInterval', () => {
    it('sets the refresh interval', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await setRefreshInterval(120)

      expect(mockInvoke).toHaveBeenCalledWith('set_refresh_interval', { intervalSecs: 120 })
    })
  })

  describe('forceRefresh', () => {
    it('forces a refresh', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await forceRefresh()

      expect(mockInvoke).toHaveBeenCalledWith('force_refresh')
    })
  })

  // ============================================================================
  // History Commands
  // ============================================================================

  describe('queryHistory', () => {
    it('returns history entries', async () => {
      const mockEntries: UsageHistoryEntry[] = [
        {
          id: '2025-01-15T12:00:00Z-claude',
          provider: 'claude',
          timestamp: '2025-01-15T12:00:00Z',
          limits: [{ id: 'five_hour', utilization: 0.45, resetsAt: '2025-01-15T17:00:00Z' }],
        },
      ]
      mockInvoke.mockResolvedValue(mockEntries)

      const result = await queryHistory({ provider: 'claude', limit: 100 })

      expect(mockInvoke).toHaveBeenCalledWith('query_history', {
        query: { provider: 'claude', limit: 100 },
      })
      expect(result).toEqual(mockEntries)
    })

    it('queries all history when no filter provided', async () => {
      mockInvoke.mockResolvedValue([])

      await queryHistory()

      expect(mockInvoke).toHaveBeenCalledWith('query_history', { query: undefined })
    })
  })

  describe('getHistoryMetadata', () => {
    it('returns history metadata', async () => {
      const mockMetadata: HistoryMetadata = {
        entryCount: 150,
        oldestEntry: '2024-12-01T00:00:00Z',
        newestEntry: '2025-01-15T12:00:00Z',
        lastCleanup: '2025-01-01T00:00:00Z',
        retentionDays: 30,
      }
      mockInvoke.mockResolvedValue(mockMetadata)

      const result = await getHistoryMetadata()

      expect(mockInvoke).toHaveBeenCalledWith('get_history_metadata')
      expect(result).toEqual(mockMetadata)
    })
  })

  describe('getRetentionPolicy', () => {
    it('returns retention policy', async () => {
      const mockPolicy: RetentionPolicy = {
        retentionDays: 30,
        autoCleanup: true,
      }
      mockInvoke.mockResolvedValue(mockPolicy)

      const result = await getRetentionPolicy()

      expect(mockInvoke).toHaveBeenCalledWith('get_retention_policy')
      expect(result).toEqual(mockPolicy)
    })
  })

  describe('setRetentionPolicy', () => {
    it('sets retention policy', async () => {
      mockInvoke.mockResolvedValue(undefined)
      const policy: RetentionPolicy = {
        retentionDays: 60,
        autoCleanup: true,
      }

      await setRetentionPolicy(policy)

      expect(mockInvoke).toHaveBeenCalledWith('set_retention_policy', { policy })
    })
  })

  describe('cleanupHistory', () => {
    it('cleans up history and returns count', async () => {
      mockInvoke.mockResolvedValue(10)

      const result = await cleanupHistory()

      expect(mockInvoke).toHaveBeenCalledWith('cleanup_history')
      expect(result).toBe(10)
    })
  })

  describe('getUsageStats', () => {
    it('returns usage statistics', async () => {
      const mockStats: UsageStats = {
        provider: 'claude',
        limitId: 'five_hour',
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-15T00:00:00Z',
        avgUtilization: 0.35,
        maxUtilization: 0.85,
        minUtilization: 0.1,
        sampleCount: 100,
      }
      mockInvoke.mockResolvedValue(mockStats)

      const result = await getUsageStats(
        'claude',
        'five_hour',
        '2025-01-01T00:00:00Z',
        '2025-01-15T00:00:00Z'
      )

      expect(mockInvoke).toHaveBeenCalledWith('get_usage_stats', {
        provider: 'claude',
        limitId: 'five_hour',
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-15T00:00:00Z',
      })
      expect(result).toEqual(mockStats)
    })

    it('returns null when no stats available', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await getUsageStats('claude', 'five_hour', '2025-01-01', '2025-01-15')

      expect(result).toBeNull()
    })
  })

  describe('exportHistoryJson', () => {
    it('exports history as JSON string', async () => {
      const mockJson = '[{"id":"entry1","provider":"claude"}]'
      mockInvoke.mockResolvedValue(mockJson)

      const result = await exportHistoryJson({ provider: 'claude' })

      expect(mockInvoke).toHaveBeenCalledWith('export_history_json', {
        query: { provider: 'claude' },
      })
      expect(result).toBe(mockJson)
    })
  })

  describe('exportHistoryCsv', () => {
    it('exports history as CSV string', async () => {
      const mockCsv = 'id,provider,timestamp\nentry1,claude,2025-01-15T12:00:00Z'
      mockInvoke.mockResolvedValue(mockCsv)

      const result = await exportHistoryCsv({ provider: 'claude' })

      expect(mockInvoke).toHaveBeenCalledWith('export_history_csv', {
        query: { provider: 'claude' },
      })
      expect(result).toBe(mockCsv)
    })
  })

  describe('clearHistory', () => {
    it('clears all history', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await clearHistory()

      expect(mockInvoke).toHaveBeenCalledWith('clear_history')
    })
  })

  // ============================================================================
  // Error Handling Integration Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('handles network errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'))

      await expect(fetchUsage('claude')).rejects.toThrow('Network error')
    })

    it('handles session expiry errors', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Session expired - please update your credentials')
      )

      await expect(fetchUsage('claude')).rejects.toThrow('Session expired')
    })

    it('handles rate limit errors', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Rate limited - please wait before retrying')
      )

      await expect(fetchUsage('claude')).rejects.toThrow('Rate limited')
    })

    it('handles Cloudflare blocked errors', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Access blocked by Cloudflare - try again later')
      )

      await expect(fetchUsage('claude')).rejects.toThrow('Cloudflare')
    })
  })
})
