"use client";
import { useEffect, useState } from "react";
export type AdminRequest = (
  path: string,
  init?: RequestInit,
) => Promise<Response>;
type Submission = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  email_status: string;
  created_at: string;
};
export default function Inbox({ request }: { request: AdminRequest }) {
  const [rows, setRows] = useState<Submission[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const response = await request("/api/admin/submissions");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Access denied.");
    setRows(result.submissions);
  }
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);
  async function mark(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await request("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "read" }),
      });
      if (!response.ok) throw new Error("Update failed.");
      await load();
    } catch {
      setMessage("Could not update the inquiry. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Inquiries</h2>
      <p>{rows.length} most recent inquiries</p>
      {!rows.length && (
        <p>
          No inquiries yet. Send a message using your website's contact form.
        </p>
      )}
      {rows.map((row) => (
        <article
          key={row.id}
          style={{ borderTop: "1px solid #bbc5b8", padding: "24px 0" }}
        >
          <h3 style={{ fontSize: 24 }}>{row.name}</h3>
          <a href={"mailto:" + row.email}>{row.email}</a>
          <p style={{ whiteSpace: "pre-wrap" }}>{row.message}</p>
          <p>
            {new Date(row.created_at).toLocaleString()} · {row.status} · Email:{" "}
            {row.email_status.replace("_", " ")}
          </p>
          {row.status === "new" && (
            <button disabled={busy} onClick={() => void mark(row.id)}>
              Mark as read
            </button>
          )}
        </article>
      ))}
      <p role="status">{message}</p>
    </section>
  );
}
