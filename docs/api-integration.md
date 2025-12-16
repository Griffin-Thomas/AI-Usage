# API Integration

## Claude

**Endpoint:** `GET https://claude.ai/api/organizations/{orgId}/usage`

### Authentication Headers

```
Cookie: sessionKey={sessionKey}
anthropic-client-platform: web_claude_ai
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131...
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin
Origin: https://claude.ai
Referer: https://claude.ai
```

### Response

```typescript
interface ClaudeUsageResponse {
  five_hour: LimitUsage;
  seven_day?: LimitUsage;
  seven_day_oauth_apps?: LimitUsage;
  seven_day_opus?: LimitUsage;
  seven_day_sonnet?: LimitUsage;
}

interface LimitUsage {
  utilization: number;  // 0-100 percentage
  resets_at: string;    // ISO 8601 timestamp
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| 401 | Session expired |
| 403 | Blocked by Cloudflare |
| 429 | Rate limited |

---

## OpenAI Codex

**Usage Model:** Task/message-based (not tokens)

### Limits

- 5-hour rolling window for local tasks
- Weekly caps for heavy usage
- Plan-based limits (Plus: ~30-150 messages/5hr)

### Status Check

CLI command `/status` shows current limits.

### API Approaches

| Approach | Description |
|----------|-------------|
| Option A | Parse CLI `/status` output (subprocess) |
| Option B | Use OpenAI API dashboard endpoint (reverse engineering) |
| Option C | Official usage API (when available) |

### Credentials

- ChatGPT session token (for dashboard access)
- OpenAI API key (for API-based usage tracking)
