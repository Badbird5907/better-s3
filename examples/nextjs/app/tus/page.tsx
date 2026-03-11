import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";

import { ThemeToggle } from "@/components/theme-toggle";
import { TusUploadDemo } from "@/components/tus-upload-demo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TusPage() {
  const { userId } = await auth();

  return (
    <>
      <main className="container mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Tus Upload Demo</CardTitle>
            <CardDescription>
              Demonstrates manual tus upload controls on top of the Silo route handler.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="underline underline-offset-4">
                Back to basic upload demo
              </Link>
            </p>
            {userId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{userId}</span>
                </p>
                <TusUploadDemo />
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  You must sign in to access this example.
                </p>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"
                  >
                    Sign in to continue
                  </button>
                </SignInButton>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <div className="fixed right-4 bottom-4 z-50">
        <ThemeToggle />
      </div>
    </>
  );
}
