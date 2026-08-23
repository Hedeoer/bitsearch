import type { FormEvent } from "react";
import { KeyRound, Search } from "lucide-react";
import { InlineSpinner } from "./components/Feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginViewProps = {
  authKey: string;
  message: string;
  onAuthKeyChange: (value: string) => void;
  onLogin: () => void;
  pending: boolean;
};

export function LoginView(props: LoginViewProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onLogin();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground sm:px-6">
      <Card className="w-full max-w-md overflow-hidden border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
        <CardHeader className="gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Search className="size-5" aria-hidden="true" />
            </div>
            <div className="grid gap-1">
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                BitSearch
              </CardDescription>
              <CardTitle className="text-lg">Operations Console</CardTitle>
            </div>
          </div>
          <CardDescription className="max-w-sm leading-6">
          Enter the admin authorization key to access the operator console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="auth-key-input">Authorization Key</Label>
              <Input
              id="auth-key-input"
              name="authKey"
              type="password"
              value={props.authKey}
              onChange={(event) => props.onAuthKeyChange(event.target.value)}
              placeholder="Paste admin authorization key"
              autoComplete="current-password"
              aria-describedby={props.message ? "login-error" : undefined}
              autoFocus
            />
            </div>
            <Button type="submit" className="w-full" disabled={props.pending}>
              {props.pending ? (
                <InlineSpinner label="Verifying" />
              ) : (
                <>
                  <KeyRound className="size-4" aria-hidden="true" />
                  Enter Console
                </>
              )}
            </Button>
          </form>
          {props.message ? (
            <p
              id="login-error"
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive-foreground"
            >
              {props.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
