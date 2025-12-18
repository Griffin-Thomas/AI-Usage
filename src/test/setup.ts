import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Tauri APIs for testing
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}))

vi.mock('@tauri-apps/api/tray', () => ({
  TrayIcon: {
    getById: vi.fn(() =>
      Promise.resolve({
        setIcon: vi.fn(),
        setTooltip: vi.fn(),
      })
    ),
  },
}))

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
  })),
}))
