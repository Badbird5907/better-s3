"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Mail, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@app/ui/components/badge";
import { Button } from "@app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@app/ui/components/dropdown-menu";
import { Skeleton } from "@app/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@app/ui/components/table";

import { authClient } from "@/auth/client";
import { useTRPC } from "@/trpc/react";

interface PendingInvitationsProps {
  organizationId: string;
  canEdit: boolean;
}

export function PendingInvitations({
  organizationId,
  canEdit,
}: PendingInvitationsProps) {
  const trpc = useTRPC();

  const invitationsQuery = useQuery(
    trpc.organization.getPendingInvitations.queryOptions({ organizationId }),
  );

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to cancel invitation");
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invitation cancelled");
      void invitationsQuery.refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? "Failed to cancel invitation");
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const result = await authClient.organization.inviteMember({
        email: data.email,
        role: data.role as "member" | "admin",
        resend: true,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Failed to resend invitation");
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invitation resent");
      void invitationsQuery.refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message ?? "Failed to resend invitation");
    },
  });

  if (invitationsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that haven&apos;t been accepted yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const invitations = invitationsQuery.data ?? [];

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that haven&apos;t been accepted yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Mail className="text-muted-foreground mb-4 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              No pending invitations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>
          Invitations that haven&apos;t been accepted yet ({invitations.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Invited By</TableHead>
              {canEdit && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => {
              const isExpired = new Date(invitation.expiresAt) < new Date();

              return (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="text-muted-foreground h-4 w-4" />
                      {invitation.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {invitation.role?.charAt(0).toUpperCase() +
                        (invitation.role?.slice(1) ?? "")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="text-muted-foreground h-4 w-4" />
                      <span className={isExpired ? "text-red-500" : ""}>
                        {isExpired
                          ? "Expired"
                          : new Date(invitation.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invitation.inviter.name}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              resendInvitationMutation.mutate({
                                email: invitation.email,
                                role: invitation.role ?? "member",
                              })
                            }
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Resend Invitation
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              cancelInvitationMutation.mutate(invitation.id)
                            }
                            className="text-red-600"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel Invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
