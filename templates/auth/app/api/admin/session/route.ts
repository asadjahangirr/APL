import { administrator, json } from "../../../../lib/server";
export async function GET(request: Request) {
  try {
    return (await administrator(request))
      ? json({ administrator: true })
      : json({ error: "Administrator access required." }, 403);
  } catch {
    return json(
      { error: "Backend setup is incomplete. Follow SETUP.md." },
      503,
    );
  }
}
