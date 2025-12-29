import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, EyeOff, Loader2, Wifi, Check, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listAccounts,
  saveAccount,
  deleteAccount,
  testAccountConnection,
  type TestConnectionResult,
} from "@/lib/tauri";
import type { Account } from "@/lib/types";
import { useAccountsStore, useUsageStore } from "@/lib/store";

interface AccountManagerProps {
  onAccountsChanged?: () => void;
}

export function AccountManager({ onAccountsChanged }: AccountManagerProps) {
  const { accounts, setAccounts } = useAccountsStore();
  const { removeAccount: removeUsage } = useUsageStore();
  const [isLoading, setIsLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formOrgId, setFormOrgId] = useState("");
  const [formSessionKey, setFormSessionKey] = useState("");
  const [showSessionKey, setShowSessionKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const accountList = await listAccounts("claude");
      setAccounts(accountList);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [setAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const resetForm = () => {
    setFormName("");
    setFormOrgId("");
    setFormSessionKey("");
    setShowSessionKey(false);
    setTestResult(null);
    setError(null);
    setEditingAccount(null);
    setIsAddingNew(false);
  };

  const handleStartAdd = () => {
    resetForm();
    setFormName(accounts.length === 0 ? "Default" : "");
    setIsAddingNew(true);
  };

  const handleStartEdit = (account: Account) => {
    setEditingAccount(account);
    setFormName(account.name);
    setFormOrgId(account.credentials.org_id || "");
    setFormSessionKey(account.credentials.session_key || "");
    setTestResult(null);
    setError(null);
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleTestConnection = async () => {
    setError(null);
    setTestResult(null);

    if (!formOrgId.trim() || !formSessionKey.trim()) {
      setTestResult({
        success: false,
        error_code: "MISSING_FIELDS",
        error_message: "Please fill in both fields",
        hint: "Both Organization ID and Session Key are required.",
      });
      return;
    }

    setIsTesting(true);
    try {
      const testAccount: Account = {
        id: editingAccount?.id || crypto.randomUUID(),
        name: formName.trim() || "Default",
        provider: "claude",
        credentials: {
          org_id: formOrgId.trim(),
          session_key: formSessionKey.trim(),
        },
        createdAt: editingAccount?.createdAt || new Date().toISOString(),
      };

      const result = await testAccountConnection(testAccount);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error_code: "UNKNOWN_ERROR",
        error_message: err instanceof Error ? err.message : String(err),
        hint: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!formOrgId.trim() || !formSessionKey.trim()) {
      setError("Both Organization ID and Session Key are required");
      return;
    }

    setIsSaving(true);
    try {
      const account: Account = {
        id: editingAccount?.id || crypto.randomUUID(),
        name: formName.trim() || "Default",
        provider: "claude",
        credentials: {
          org_id: formOrgId.trim(),
          session_key: formSessionKey.trim(),
        },
        createdAt: editingAccount?.createdAt || new Date().toISOString(),
      };

      await saveAccount(account);
      await loadAccounts();
      resetForm();
      onAccountsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      await deleteAccount(accountId);
      removeUsage(accountId);
      await loadAccounts();
      onAccountsChanged?.();
    } catch (err) {
      console.error("Failed to delete account:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const isFormOpen = isAddingNew || editingAccount !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Accounts</h3>
        {!isFormOpen && (
          <Button variant="outline" size="sm" onClick={handleStartAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Account
          </Button>
        )}
      </div>

      {/* Account List */}
      {accounts.length > 0 && !isFormOpen && (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {account.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-sm">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.credentials.org_id?.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStartEdit(account)}
                  className="h-8 w-8"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  {deletingId === account.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {accounts.length === 0 && !isFormOpen && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No accounts configured</p>
          <p className="text-xs mt-1">Add an account to start tracking usage</p>
        </div>
      )}

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {editingAccount ? "Edit Account" : "Add Account"}
            </h4>
            <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              placeholder="e.g., Personal, Work"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this account
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-id">Organization ID</Label>
            <Input
              id="org-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={formOrgId}
              onChange={(e) => setFormOrgId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Claude.ai URL: claude.ai/settings/organization/[org-id]
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-key">Session Key</Label>
            <div className="relative">
              <Input
                id="session-key"
                type={showSessionKey ? "text" : "password"}
                placeholder="sk-ant-..."
                value={formSessionKey}
                onChange={(e) => setFormSessionKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSessionKey(!showSessionKey)}
              >
                {showSessionKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find this in browser DevTools: Application → Cookies → sessionKey
            </p>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={`p-3 rounded-md text-sm ${
                testResult.success
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <p className="font-medium">
                {testResult.success ? "Connection successful!" : testResult.error_message}
              </p>
              {testResult.hint && !testResult.success && (
                <p className="text-xs mt-1 opacity-80">{testResult.hint}</p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving || !formOrgId.trim() || !formSessionKey.trim()}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : testResult?.success ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              {isTesting ? "Testing..." : "Test"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isTesting} className="flex-1">
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isSaving ? "Saving..." : editingAccount ? "Update Account" : "Add Account"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
