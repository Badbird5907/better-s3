"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Building2, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";

import { authClient } from "@/auth/client";

interface InvitePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [invitationDetails, setInvitationDetails] = React.useState<{
    organizationName: string;
    organizationSlug: string;
    role: string;
    email: string;
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch invitation details
  React.useEffect(() => {
    async function fetchInvitation() {
      try {
        const result = await authClient.organization.getInvitation({
          query: { id: token },
        });
        if (result.error) {
          setError(result.error.message || "Invalid or expired invitation");
        } else if (result.data) {
          setInvitationDetails({
            organizationName: result.data.organizationName,
            organizationSlug: result.data.organizationSlug,
            role: result.data.role,
            email: result.data.email,
          });
        }
      } catch {
        setError("Failed to load invitation details");
      } finally {
        setLoadingDetails(false);
      }
    }
    fetchInvitation();
  }, [token]);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.organization.acceptInvitation({
        invitationId: token,
      });
      if (result.error) {
        throw new Error(result.error.message || "Failed to accept invitation");
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invitation accepted! Welcome to the team.");
      if (invitationDetails?.organizationSlug) {
        router.push(`/${invitationDetails.organizationSlug}`);
      } else {
        router.push("/");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept invitation");
    },
  });

  const handleAccept = () => {
    acceptMutation.mutate();
  };

  const handleLogin = () => {
    // Redirect to login with return URL
    const returnUrl = `/invite/${token}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
  };

  if (loadingDetails || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invitationDetails) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Building2 className="text-primary h-6 w-6" />
          </div>
          <CardTitle>Join {invitationDetails.organizationName}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as{" "}
            <span className="font-medium">
              {invitationDetails.role.charAt(0).toUpperCase() +
                invitationDetails.role.slice(1)}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">Invitation sent to</p>
            <p className="font-medium">{invitationDetails.email}</p>
          </div>

          {!session?.user && (
            <p className="text-muted-foreground text-center text-sm">
              You need to sign in to accept this invitation
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>
          {session?.user ? (
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleLogin}>
              Sign In to Accept
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
