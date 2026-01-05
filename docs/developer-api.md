# Developer API

AI Pulse includes a local REST API server that enables CLI tools, IDE integrations, and custom scripts to access usage data.

## Enabling the API Server

1. Open AI Pulse
2. Go to **Settings** → **Developer**
3. Toggle **Enable Local API Server**
4. (Optional) Set a custom port (default: 31415)
5. (Optional) Generate an auth token for security
6. Restart AI Pulse for changes to take effect

## Base URL

```
http://127.0.0.1:31415
```

The server only binds to localhost for security - it cannot be accessed from other machines.

## Authentication

If an auth token is configured in Settings, include it in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:31415/status
```

The `/health` endpoint does not require authentication.

## Endpoints

### GET /health

Health check endpoint. Returns server status and version.

**Response:**
```json
{
  "status": "ok",
  "version": "0.17.0"
}
```

### GET /status

Get current usage status for all configured accounts.

**Response:**
```json
{
  "timestamp": "2025-12-30T10:30:00Z",
  "accounts": [
    {
      "id": "uuid-here",
      "name": "Personal",
      "provider": "claude",
      "limits": [
        {
          "id": "five_hour",
          "label": "5-Hour Limit",
          "utilization": 45.5,
          "resetsAt": "2025-12-30T15:00:00Z"
        },
        {
          "id": "seven_day",
          "label": "Weekly Limit",
          "utilization": 23.2,
          "resetsAt": "2026-01-05T00:00:00Z"
        }
      ],
      "lastUpdated": "2025-12-30T10:25:00Z",
      "sessionValid": true
    }
  ]
}
```

### GET /status/:account_id

Get usage status for a specific account.

**Parameters:**
- `account_id` - The account UUID

**Response:** Same as single account in `/status` response.

**Errors:**
- `404` - Account not found

### GET /accounts

List all configured accounts (without credentials).

**Response:**
```json
{
  "accounts": [
    {
      "id": "uuid-here",
      "name": "Personal",
      "provider": "claude",
      "createdAt": "2025-12-01T00:00:00Z"
    }
  ]
}
```

### GET /history

Query usage history with optional filters.

**Query Parameters:**
- `startDate` - ISO 8601 timestamp (e.g., `2025-12-01T00:00:00Z`)
- `endDate` - ISO 8601 timestamp
- `provider` - Filter by provider (e.g., `claude`)
- `accountId` - Filter by account UUID
- `limit` - Maximum number of entries
- `offset` - Skip first N entries

**Example:**
```bash
curl "http://127.0.0.1:31415/history?startDate=2025-12-29T00:00:00Z&limit=10"
```

**Response:**
```json
{
  "entries": [
    {
      "id": "entry-uuid",
      "provider": "claude",
      "accountId": "account-uuid",
      "accountName": "Personal",
      "timestamp": "2025-12-30T10:00:00Z",
      "limits": [
        {
          "id": "five_hour",
          "utilization": 45.5,
          "resetsAt": "2025-12-30T15:00:00Z"
        }
      ]
    }
  ],
  "total": 1
}
```

### POST /refresh

Trigger an immediate usage refresh for all accounts.

**Response:**
```json
{
  "success": true,
  "message": "Refresh triggered"
}
```

**Rate Limited Response:**
```json
{
  "success": false,
  "message": "Rate limited. Please wait before refreshing again."
}
```

## Error Responses

All endpoints may return these error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```
Returned when auth token is configured but not provided or incorrect.

### 500 Internal Server Error
```json
{
  "error": "Failed to query history: ..."
}
```

## Examples

### Check if server is running
```bash
curl http://127.0.0.1:31415/health
```

### Get all usage (with auth)
```bash
curl -H "Authorization: Bearer mytoken123" http://127.0.0.1:31415/status
```

### Get usage as JSON for scripting
```bash
curl -s http://127.0.0.1:31415/status | jq '.accounts[0].limits[0].utilization'
```

### Get last 7 days of history
```bash
START=$(date -v-7d -u +"%Y-%m-%dT00:00:00Z")
curl "http://127.0.0.1:31415/history?startDate=$START"
```

## Integration Ideas

- **IDE Status Bar**: Poll `/status` every 60s to show usage in VS Code
- **Shell Prompt**: Include usage percentage in your terminal prompt
- **Slack Bot**: Post daily usage summaries to a channel
- **Monitoring**: Send metrics to Grafana/Datadog via custom script
