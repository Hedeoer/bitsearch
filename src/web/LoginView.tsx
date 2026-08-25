import type { FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { BitSearchLogo } from "./components/BitSearchLogo";
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
    <main className="login-scene grid min-h-screen place-items-center bg-background px-4 py-8 text-foreground sm:px-6">
      <Card className="login-enter w-full max-w-md overflow-hidden rounded-2xl border-border/70 bg-card shadow-glow">
        <CardHeader className="gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <BitSearchLogo className="size-6" />
            </div>
            <div className="grid gap-0.5">
              <CardDescription className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                BitSearch
              </CardDescription>
              <CardTitle className="text-lg">Admin Access</CardTitle>
            </div>
          </div>
          <CardDescription className="max-w-sm leading-6">
            Enter the admin authorization key to access the operator console.
          </CardDescription>
        </CardHeader>
        <CardContent className="login-enter-2">
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
                className="h-10 font-mono text-sm tracking-tight"
              />
            </div>
            <Button
              type="submit"
              className="w-full transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
              disabled={props.pending}
            >
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
              className="login-error mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {props.message}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
