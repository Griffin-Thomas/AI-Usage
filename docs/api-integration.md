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

## ChatGPT (OpenAI)

**Status:** ⚠️ BLOCKED - No server-side usage tracking available

### Research Findings (December 2025)

Unlike Claude, OpenAI does not expose an API endpoint that returns current usage/utilization for the ChatGPT web interface.

**Available Endpoints:**

| Endpoint | Returns | Useful? |
|----------|---------|---------|
| `/public-api/conversation_limit` | `message_cap` (e.g., 80), `message_cap_window` (180 min) | ⚠️ Caps only |
| `/api/auth/session` | Access token (JWT), expiry | ✅ Auth |
| `/backend-api/models` | Available models list | ❌ No usage |
| `/backend-api/conversation` | Chat responses (streaming) | ❌ No usage |

**Key Limitation:**
- Claude returns `utilization: 0.45` (45% used) - we can track usage
- ChatGPT returns `message_cap: 80` but NOT how many have been used

### Limits Structure (2025)

| Plan | Model | Limit | Window |
|------|-------|-------|--------|
| Plus ($20/mo) | GPT-4o | 80 messages | 3 hours |
| Plus | GPT-4 | 40 messages | 3 hours |
| Plus | o3 | 100 messages | 1 week |
| Pro ($200/mo) | All | Unlimited | - |

### Workaround Options (Not Implemented)

1. **Client-side tracking**: Count messages locally (doesn't sync across devices)
2. **Conversation history**: Fetch recent messages and count (complex, slow)
3. **Manual input**: Let users enter their remaining messages

### Authentication (For Future Reference)

```
Cookie: __Secure-next-auth.session-token={token}
Authorization: Bearer {accessToken}
```

Session token can be obtained from browser cookies at `chatgpt.com`.

### Sources

- [ChatGPT-4o-Message-Limit-Tracker](https://github.com/guohaiping/ChatGPT-4o-Message-Limit-Tracker)
- [ChatGPTReversed](https://github.com/gin337/ChatGPTReversed)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

---

## Google Gemini

**Status:** ⚠️ BLOCKED - Complex Cloud Monitoring API required

### Research Findings (December 2025)

Google provides two ways to access Gemini:

1. **Gemini Web (gemini.google.com)** - Free web chat, no usage API found
2. **Gemini Developer API (ai.google.dev)** - Paid/free tier API, usage trackable via Cloud Monitoring

### Gemini Web Interface

Like ChatGPT, the Gemini web interface does not expose a usage tracking endpoint.

**Available (Reverse-Engineered):**

| Resource | Description | Useful? |
|----------|-------------|---------|
| Cookies (`__Secure-1PSID`) | Session authentication | ✅ Auth |
| [Gemini-API](https://github.com/HanaokaYuzu/Gemini-API) | Reverse-engineered Python wrapper | ❌ No usage tracking |

### Gemini Developer API

Usage CAN be tracked, but requires complex setup:

**Method:** Google Cloud Monitoring API

```bash
# Example query (requires gcloud auth)
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://monitoring.googleapis.com/v3/projects/{PROJECT_ID}/timeSeries:list" \
  -d '{
    "filter": "metric.type=\"serviceruntime.googleapis.com/api/request_count\"",
    "interval": {"endTime": "...", "startTime": "..."}
  }'
```

**Requirements:**
1. Google Cloud project with billing enabled
2. Cloud Monitoring API enabled
3. Service account or OAuth2 credentials
4. Complex MQL/PromQL queries

### Rate Limits Structure (2025)

| Tier | Model | RPM | TPM | RPD |
|------|-------|-----|-----|-----|
| Free | Gemini 2.5 Flash | 15 | 250,000 | ~100 |
| Free | Gemini 2.5 Pro | 5 | 250,000 | ~100 |
| Paid Tier 1 | Gemini 2.5 Flash | 1,000 | 4M | 14,400 |

Note: Limits reset at midnight Pacific Time.

### View Usage in AI Studio

Users can manually check usage at:
`https://aistudio.google.com/usage?timeRange=last-28-days&tab=rate-limit`

### Why Not Implemented

The complexity of the Cloud Monitoring API approach makes it impractical for a lightweight desktop app:
- Requires Google Cloud project setup by each user
- OAuth2 flow more complex than Claude's session key
- API queries require understanding of MQL/PromQL

### Sources

- [Gemini CLI Discussion #3096](https://github.com/google-gemini/gemini-cli/discussions/3096)
- [Gemini Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Cloud Monitoring API](https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list)
- [Gemini-API (Reverse Engineered)](https://github.com/HanaokaYuzu/Gemini-API)
