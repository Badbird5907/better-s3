import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadDemo } from "@/components/upload-demo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const { userId } = await auth();

  return (
    <>
      <main className="container mx-auto flex min-h-[calc(100vh-80px)] max-w-3xl items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Silo Next.js Upload Example</CardTitle>
            <CardDescription>
              Upload image files to Silo, then generate a signed download link for
              each uploaded file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userId ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{userId}</span>
                </p>
                <UploadDemo />
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
