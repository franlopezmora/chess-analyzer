"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  providers: {
    credentials: boolean;
    google: boolean;
    github: boolean;
  };
};

export function LoginForm({ providers }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("demo@chess-analyzer.dev");
  const [password, setPassword] = useState("Demo1234!");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleCredentialsSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setStatus("error");
      setMessage("Credenciales inválidas");
      return;
    }

    setStatus("idle");
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {providers.credentials && (
        <form onSubmit={handleCredentialsSignIn} className="space-y-4">
          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-control mt-1"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="input-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-control mt-1"
              autoComplete="current-password"
              required
            />
            <p className="mt-1 text-xs text-muted">
              Demo: <kbd>Demo1234!</kbd>
            </p>
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full justify-center"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Ingresando..." : "Ingresar"}
          </button>
          {message && <p className="alert alert-error text-center">{message}</p>}
        </form>
      )}

      {(providers.google || providers.github) && (
        <div className="space-y-3">
          <div className="divider">
            <span className="divider-line" />
            O continuar con
            <span className="divider-line" />
          </div>

          {providers.google && (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="btn btn-outline w-full justify-center border border-solid"
            >
              Google
            </button>
          )}

          {providers.github && (
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/" })}
              className="btn btn-outline w-full justify-center border border-solid"
            >
              GitHub
            </button>
          )}
        </div>
      )}
    </div>
  );
}

