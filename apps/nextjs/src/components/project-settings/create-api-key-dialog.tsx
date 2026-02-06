"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Key, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@app/ui/components/dialog";
import { Input } from "@app/ui/components/input";
import { Label } from "@app/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@app/ui/components/select";

import { useTRPC } from "@/trpc/react";

interface CreateApiKeyDialogProps {
  projectId: string;
  organizationId: string;
  onCreated?: () => void;
}

export function CreateApiKeyDialog({
  projectId,
  organizationId,
  onCreated,
}: CreateApiKeyDialogProps) {
  const trpc = useTRPC();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [environmentId, setEnvironmentId] = React.useState<string>("all");
  const [expirationOption, setExpirationOption] =
    React.useState<string>("never");
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const environmentsQuery = useQuery(
    {
      ...trpc.apiKey.getEnvironments.queryOptions(
        { projectId, organizationId },
      ),
      enabled: open && !!organizationId,
    },
  );

  const createMutation = useMutation(
    trpc.apiKey.create.mutationOptions({
      onSuccess: (data) => {
        setCreatedKey(data.key);
        onCreated?.();
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? "Failed to create API key");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Calculate expiration date based on selected option
    let expiresAt: Date | undefined;
    if (expirationOption !== "never") {
      const now = new Date();
      switch (expirationOption) {
        case "7d":
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case "60d":
          expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    createMutation.mutate({
      projectId,
      organizationId,
      name: name.trim(),
      environmentId: environmentId === "all" ? undefined : environmentId,
      expiresAt,
    });
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setName("");
      setEnvironmentId("all");
      setExpirationOption("never");
      setCreatedKey(null);
      setCopied(false);
      createMutation.reset();
    }, 200);
  };

  const environments = environmentsQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Key className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Your new API key has been created. Make sure to copy it now -
                you won&apos;t be able to see it again!
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted flex-1 rounded-md border px-3 py-2 font-mono text-sm break-all">
                    {createdKey}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyKey}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Store this key securely. It will not be shown again.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for programmatic access to this project.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Server, CI/CD Pipeline"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  A descriptive name to help you identify this key
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={environmentId} onValueChange={setEnvironmentId}>
                  <SelectTrigger id="environment">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    {environments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name}
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({env.type})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Restrict this key to a specific environment, or allow access
                  to all
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration</Label>
                <Select
                  value={expirationOption}
                  onValueChange={setExpirationOption}
                >
                  <SelectTrigger id="expiresAt">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="60d">60 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                    <SelectItem value="1y">1 year</SelectItem>
                    <SelectItem value="never">No expiration</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Choose when this API key should expire
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
