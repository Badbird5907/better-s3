"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@silo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@silo/ui/components/dialog";
import { Input } from "@silo/ui/components/input";
import { Label } from "@silo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@silo/ui/components/select";

import { authClient } from "@/auth/client";
import { useTRPC } from "@/trpc/react";

interface CreatePersonalEnvironmentWizardProps {
  projectId: string;
  organizationId: string;
  autoOpen?: boolean;
  onCreated?: () => void;
  onOpenChange?: (open: boolean) => void;
}

interface EnvironmentVariableRowProps {
  label: string;
  value: string | null;
  copied: boolean;
  onCopy: () => void;
}

interface CreatedValues {
  apiKey: string | null;
  environmentSlug: string | null;
  signingSecret: string | null;
}

type CopyField = keyof CreatedValues;

const EMPTY_CREATED_VALUES: CreatedValues = {
  apiKey: null,
  environmentSlug: null,
  signingSecret: null,
};

const EMPTY_COPIED_VALUES: Record<CopyField, boolean> = {
  apiKey: false,
  environmentSlug: false,
  signingSecret: false,
};

function EnvironmentVariableRow({
  label,
  value,
  copied,
  onCopy,
}: EnvironmentVariableRowProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <code className="bg-muted flex-1 rounded-md border px-3 py-2 font-mono text-xs break-all">
          {value}
        </code>
        <Button variant="outline" size="icon" onClick={onCopy} className="shrink-0">
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function CreatePersonalEnvironmentWizard({
  projectId,
  organizationId,
  autoOpen = false,
  onCreated,
  onOpenChange,
}: CreatePersonalEnvironmentWizardProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const userName = session?.user.name.trim();
  const defaultName = userName && userName.length > 0 ? `${userName}'s Dev Env` : "My Dev Env";
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [name, setName] = React.useState(defaultName);
  const [hasEditedName, setHasEditedName] = React.useState(false);
  const [shouldCreateApiKey, setShouldCreateApiKey] = React.useState(false);
  const [apiKeyName, setApiKeyName] = React.useState("");
  const [hasEditedApiKeyName, setHasEditedApiKeyName] = React.useState(false);
  const [createdValues, setCreatedValues] =
    React.useState<CreatedValues>(EMPTY_CREATED_VALUES);
  const [copiedValues, setCopiedValues] = React.useState(EMPTY_COPIED_VALUES);

  React.useEffect(() => {
    if (hasEditedName) return;
    setName(defaultName);
  }, [defaultName, hasEditedName]);

  React.useEffect(() => {
    if (hasEditedApiKeyName) return;
    const resolvedName = name.trim() || defaultName;
    setApiKeyName(`${resolvedName} API Key`);
  }, [name, defaultName, hasEditedApiKeyName]);

  React.useEffect(() => {
    if (!autoOpen) return;
    setOpen(true);
  }, [autoOpen]);

  const createMutation = useMutation(
    trpc.environment.createPersonal.mutationOptions({
      onSuccess: async (environment) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.environment.list.queryKey(),
        });
        if (shouldCreateApiKey) {
          if (!environment?.id) {
            toast.error("Environment was created but no environment id was returned");
            return;
          }
          try {
            const apiKeyResult = await createApiKeyMutation.mutateAsync({
              organizationId,
              projectId,
              name: apiKeyName.trim() || `${name.trim() || defaultName} API Key`,
              environmentId: environment.id,
            });
            setCreatedValues({
              apiKey: apiKeyResult.key,
              signingSecret: apiKeyResult.signingSecret,
              environmentSlug: environment.slug,
            });
            setStep(3);
            onCreated?.();
            return;
          } catch {
            return;
          }
        }
        toast.success("Personal development environment created");
        onCreated?.();
        handleOpenChange(false);
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? "Failed to create development environment");
      },
    }),
  );
  const createApiKeyMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? "Failed to create API key");
      },
    }),
  );

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setStep(1);
      setHasEditedName(false);
      setShouldCreateApiKey(false);
      setHasEditedApiKeyName(false);
      setApiKeyName("");
      setCreatedValues(EMPTY_CREATED_VALUES);
      setCopiedValues(EMPTY_COPIED_VALUES);
      setName(defaultName);
      createMutation.reset();
      createApiKeyMutation.reset();
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      organizationId,
      projectId,
      preferredName: name.trim() || undefined,
    });
  };

  const isCreating = createMutation.isPending || createApiKeyMutation.isPending;

  const copyCreatedValue = React.useCallback(
    async (field: CopyField, successMessage: string) => {
      const value = createdValues[field];
      if (!value) return;

      await navigator.clipboard.writeText(value);
      setCopiedValues((prev) => ({ ...prev, [field]: true }));
      toast.success(successMessage);
      setTimeout(() => {
        setCopiedValues((prev) => ({ ...prev, [field]: false }));
      }, 1500);
    },
    [createdValues],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your development environment</DialogTitle>
          <DialogDescription>
            This environment is for your local development environment.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personal-env-name">Environment name</Label>
              <Input
                id="personal-env-name"
                value={name}
                onChange={(event) => {
                  setHasEditedName(true);
                  setName(event.target.value);
                }}
                placeholder={defaultName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-api-key">Create an API key now?</Label>
              <Select
                value={shouldCreateApiKey ? "yes" : "no"}
                onValueChange={(value) => setShouldCreateApiKey(value === "yes")}
              >
                <SelectTrigger id="create-api-key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shouldCreateApiKey && (
              <div className="space-y-2">
                <Label htmlFor="api-key-name">API key name</Label>
                <Input
                  id="api-key-name"
                  value={apiKeyName}
                  onChange={(event) => {
                    setHasEditedApiKeyName(true);
                    setApiKeyName(event.target.value);
                  }}
                  placeholder={`${name.trim() || defaultName} API Key`}
                />
              </div>
            )}
          </div>
        ) : step === 2 ? (
          <div className="space-y-4 text-sm">
            <p>
              Your SDK configuration will target this environment with:
              <br />
              <code>SILO_API_KEY</code>
              <br />
              <code>SILO_ENV</code>
            </p>
            <p className="text-muted-foreground">
              Name: <strong>{name.trim() || defaultName}</strong>
            </p>
            <p className="text-muted-foreground">
              Create API key: <strong>{shouldCreateApiKey ? "Yes" : "No"}</strong>
            </p>
            {shouldCreateApiKey && (
              <p className="text-muted-foreground">
                API key name:{" "}
                <strong>
                  {apiKeyName.trim() || `${name.trim() || defaultName} API Key`}
                </strong>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <p>Environment and API key created.</p>
            {createdValues.apiKey && (
              <EnvironmentVariableRow
                label="SILO_API_KEY"
                value={createdValues.apiKey}
                copied={copiedValues.apiKey}
                onCopy={() => void copyCreatedValue("apiKey", "API key copied")}
              />
            )}
            <EnvironmentVariableRow
              label="SILO_ENV"
              value={createdValues.environmentSlug}
              copied={copiedValues.environmentSlug}
              onCopy={() =>
                void copyCreatedValue("environmentSlug", "Environment slug copied")
              }
            />
            {createdValues.signingSecret && (
              <EnvironmentVariableRow
                label="SILO_SIGNING_SECRET"
                value={createdValues.signingSecret}
                copied={copiedValues.signingSecret}
                onCopy={() =>
                  void copyCreatedValue("signingSecret", "Signing secret copied")
                }
              />
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)} disabled={!name.trim()}>
                Continue
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || (shouldCreateApiKey && !apiKeyName.trim())}
              >
                {isCreating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create environment
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
