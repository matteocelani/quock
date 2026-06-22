import { User } from "@/gotypes";
import type { ApiClient } from "@/lib/api/client";
import { API_ROUTES, CLOUD_BASE_URL } from "@/lib/api/config";
import { AuthRequiredError } from "@/lib/api/errors";

// `ollama.com`'s `/api/me` emits PascalCase (`Name`, `Email`, `ID`, `AvatarURL`) — the Go struct lacks json tags — while the app-server build used by the desktop UI emits camelCase. We accept both shapes here so the mobile client works against either backend without a server change.
interface MeResponse {
  id?: string;
  email?: string;
  name?: string;
  bio?: string;
  avatarurl?: string;
  firstname?: string;
  lastname?: string;
  plan?: string;
  ID?: string;
  Email?: string;
  Name?: string;
  Bio?: string;
  AvatarURL?: string;
  FirstName?: string;
  LastName?: string;
  Plan?: string;
}

function normalizeMeResponse(data: MeResponse): {
  id: string | undefined;
  email: string | undefined;
  name: string | undefined;
  bio: string | undefined;
  avatarurl: string | undefined;
  firstname: string | undefined;
  lastname: string | undefined;
  plan: string | undefined;
} {
  return {
    id: data.id ?? data.ID,
    email: data.email ?? data.Email,
    name: data.name ?? data.Name,
    bio: data.bio ?? data.Bio,
    avatarurl: data.avatarurl ?? data.AvatarURL,
    firstname: data.firstname ?? data.FirstName,
    lastname: data.lastname ?? data.LastName,
    plan: data.plan ?? data.Plan,
  };
}
// Null means not signed in; other errors propagate so callers can distinguish offline vs expired.
export async function fetchCurrentUser(
  client: ApiClient,
): Promise<User | null> {
  try {
    const data = await client.json<MeResponse>(API_ROUTES.me, {
      method: "POST",
    });
    const normalized = normalizeMeResponse(data);
    // Gate `isAuthenticated` on `name` (mirrors the web app's check). A 200 with no name means a session is missing (cookie-leak or anonymous response), regardless of which case the server emitted.
    if (!normalized.name) {
      return null;
    }

    const user = new User(normalized);
    // Resolve relative avatar URLs so <Image> consumers don't need the base URL. CLOUD_BASE_URL has no trailing
    // slash, so guarantee exactly one separator whether the server sends "/path" or a bare "path".
    if (user.avatarurl && !user.avatarurl.startsWith("http")) {
      const path = user.avatarurl.startsWith("/")
        ? user.avatarurl
        : `/${user.avatarurl}`;
      user.avatarurl = `${CLOUD_BASE_URL}${path}`;
    }
    return user;
  } catch (e) {
    if (e instanceof AuthRequiredError) {
      return null;
    }
    throw e;
  }
}

export async function signOut(client: ApiClient): Promise<void> {
  await client.fetch(API_ROUTES.signout, { method: "POST" });
}
