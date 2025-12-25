import { useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  saveCredentials,
  testConnection,
  type Credentials,
  type TestConnectionResult,
} from "@/lib/tauri";
import { open } from "@tauri-apps/plugin-shell";

interface OnboardingProps {
  onComplete: () => void;
}

type Step = "welcome" | "guide" | "credentials" | "complete";

const STEPS: Step[] = ["welcome", "guide", "credentials", "complete"];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [orgId, setOrgId] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [showSessionKey, setShowSessionKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentIndex = STEPS.indexOf(currentStep);

  const goNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  }, [currentIndex]);

  const goBack = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  }, [currentIndex]);

  const handleTestConnection = async () => {
    if (!orgId.trim() || !sessionKey.trim()) {
      setTestResult({
        success: false,
        error_code: "MISSING_FIELDS",
        error_message: "Please fill in both fields",
        hint: "Both Organization ID and Session Key are required.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const credentials: Credentials = {
        org_id: orgId.trim(),
        session_key: sessionKey.trim(),
      };
      const result = await testConnection("claude", credentials);
      setTestResult(result);

      if (result.success) {
        // Auto-save and proceed on success
        await saveCredentials("claude", credentials);
        setTimeout(goNext, 1000); // Give user time to see success
      }
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

  const handleSaveAndContinue = async () => {
    if (!orgId.trim() || !sessionKey.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const credentials: Credentials = {
        org_id: orgId.trim(),
        session_key: sessionKey.trim(),
      };
      await saveCredentials("claude", credentials);
      goNext();
    } catch (err) {
      setTestResult({
        success: false,
        error_code: "SAVE_ERROR",
        error_message: err instanceof Error ? err.message : String(err),
        hint: "Failed to save credentials. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = () => {
    onComplete();
  };

  const openClaude = async () => {
    try {
      await open("https://claude.ai");
    } catch (err) {
      console.error("Failed to open Claude.ai:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center pb-2">
          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mb-4">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`h-2 w-8 rounded-full transition-colors ${
                  index <= currentIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Welcome Step */}
          {currentStep === "welcome" && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <CardTitle className="text-2xl">Welcome to AI Pulse</CardTitle>
              <CardDescription className="text-base">
                Track your Claude AI usage directly from your menu bar. Get
                real-time updates, notifications when you're approaching limits,
                and detailed analytics of your usage patterns.
              </CardDescription>
              <div className="pt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Real-time usage monitoring in menu bar</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Notifications before hitting limits</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Usage analytics and history</span>
                </div>
              </div>
              <Button onClick={goNext} className="mt-6">
                Get Started
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Guide Step */}
          {currentStep === "guide" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <CardTitle className="text-xl">
                  How to Get Your Credentials
                </CardTitle>
                <CardDescription>
                  Follow these steps to get your Claude credentials
                </CardDescription>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 items-start p-4 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-medium">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Open Claude.ai</p>
                    <p className="text-sm text-muted-foreground">
                      Log in to your Claude account at claude.ai
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openClaude}
                      className="mt-2"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Claude.ai
                    </Button>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-4 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-medium">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Find Your Organization ID</p>
                    <p className="text-sm text-muted-foreground">
                      Go to Settings → Organization. Copy the ID from the URL:
                    </p>
                    <code className="block mt-2 text-xs bg-muted p-2 rounded">
                      claude.ai/settings/organization/
                      <span className="text-primary font-medium">
                        your-org-id-here
                      </span>
                    </code>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-4 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-medium">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Get Your Session Key</p>
                    <p className="text-sm text-muted-foreground">
                      Open DevTools (F12 or Cmd+Option+I), go to Application →
                      Cookies → claude.ai, and copy the{" "}
                      <code className="text-primary">sessionKey</code> value.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={goBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={goNext}>
                  I Have My Credentials
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Credentials Step */}
          {currentStep === "credentials" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <CardTitle className="text-xl">Enter Your Credentials</CardTitle>
                <CardDescription>
                  Paste your Claude credentials to connect
                </CardDescription>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboard-org-id">Organization ID</Label>
                  <Input
                    id="onboard-org-id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={orgId}
                    onChange={(e) => {
                      setOrgId(e.target.value);
                      setTestResult(null);
                    }}
                    disabled={isTesting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="onboard-session-key">Session Key</Label>
                  <div className="relative">
                    <Input
                      id="onboard-session-key"
                      type={showSessionKey ? "text" : "password"}
                      placeholder="sk-ant-sid01-..."
                      value={sessionKey}
                      onChange={(e) => {
                        setSessionKey(e.target.value);
                        setTestResult(null);
                      }}
                      className="pr-10"
                      disabled={isTesting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSessionKey(!showSessionKey)}
                      disabled={isTesting}
                    >
                      {showSessionKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Test Connection Result */}
                {testResult && (
                  <div
                    className={`p-4 rounded-lg flex gap-3 ${
                      testResult.success
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-medium">
                        {testResult.success
                          ? "Connection successful!"
                          : testResult.error_message}
                      </p>
                      {testResult.hint && !testResult.success && (
                        <p className="text-sm opacity-80">{testResult.hint}</p>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || !orgId.trim() || !sessionKey.trim()}
                  className="w-full"
                  variant={testResult?.success ? "outline" : "default"}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing Connection...
                    </>
                  ) : testResult?.success ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Connection Verified
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={goBack} disabled={isTesting}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSaveAndContinue}
                  disabled={isTesting || isSaving || !orgId.trim() || !sessionKey.trim()}
                >
                  Skip Test & Save
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === "complete" && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription className="text-base">
                AI Pulse is now connected to your Claude account. Your usage
                will appear in the menu bar and update automatically.
              </CardDescription>
              <div className="pt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Look for the usage icon in your menu bar</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Click it anytime to see detailed usage</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span>Adjust settings via the gear icon</span>
                </div>
              </div>
              <Button onClick={handleFinish} className="mt-6">
                Start Using AI Pulse
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
