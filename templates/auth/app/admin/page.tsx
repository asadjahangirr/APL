"use client";
import { useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AdminModules from "./Modules";
import modules from "../../admin-modules.json";
export default function Admin() {
  const [client] = useState<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: true },
        })
      : null;
  });
  const [signedIn, setSignedIn] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  async function request(path: string, init?: RequestInit) {
    const session = await client!.auth.getSession();
    const headers = new Headers(init?.headers);
    headers.set(
      "Authorization",
      "Bearer " + session.data.session?.access_token,
    );
    return fetch(path, { ...init, headers });
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      const result = await client!.auth.signInWithPassword({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      if (result.error)
        throw new Error("Login failed. Check your email and password.");
      const response = await request("/api/admin/session");
      if (!response.ok)
        throw new Error((await response.json()).error || "Access denied.");
      setSignedIn(true);
    } catch (error) {
      await client?.auth.signOut();
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="site"
      style={{ minHeight: "100dvh", padding: "40px 24px" }}
    >
      <div style={{ maxWidth: 1100, margin: "auto" }}>
        <a href="/">← Website</a>
        <h1 style={{ fontSize: 40, marginTop: 40 }}>
          {(modules.services || modules.portfolio) ? "Website content" : "Website inbox"}
        </h1>
        {!client ? (
          <p role="alert">
            Backend setup is incomplete. Follow SETUP.md and rebuild after
            setting the public Supabase variables.
          </p>
        ) : !signedIn ? (
          <form onSubmit={login} style={{ maxWidth: 400 }}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="site-button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p>
              Use the administrator created with the setup command. Public
              signup is not provided.
            </p>
          </form>
        ) : (
          <>
            <button
              className="site-button"
              onClick={async () => {
                if (
                  dirty &&
                  !window.confirm("Discard unsaved content edits and sign out?")
                )
                  return;
                await client.auth.signOut();
                setSignedIn(false);
                setDirty(false);
              }}
            >
              Sign out
            </button>
            <AdminModules request={request} onDirtyChange={setDirty} />
          </>
        )}
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
