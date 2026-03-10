"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Layers, Loader2 } from "lucide-react";
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

interface CreateEnvironmentDialogProps {
  projectId: string;
  organizationId: string;
  onCreated?: () => void;
}

export function CreateEnvironmentDialog({
  projectId,
  organizationId,
  onCreated,
}: CreateEnvironmentDialogProps) {
  const trpc = useTRPC();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<
    "development" | "staging" | "production"
  >("development");

  const createMutation = useMutation(
    trpc.environment.create.mutationOptions({
      onSuccess: () => {
        toast.success("Environment created successfully");
        onCreated?.();
        handleClose();
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? "Failed to create environment");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      projectId,
      organizationId,
      name: name.trim(),
      type,
    });
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setName("");
      setType("development");
      createMutation.reset();
    }, 200);
  };

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
          <Layers className="mr-2 h-4 w-4" />
          Create Environment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Environment</DialogTitle>
            <DialogDescription>
              Create a new environment for this project. Environments help
              organize your files and API keys across different stages.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="env-name">Name</Label>
              <Input
                id="env-name"
                placeholder="e.g., Development, Staging, Production"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-muted-foreground text-xs">
                A descriptive name for this environment
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="env-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as "development" | "staging" | "production")
                }
              >
                <SelectTrigger id="env-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                The type determines how this environment is categorized
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
              Create Environment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
