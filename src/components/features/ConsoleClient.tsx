"use client";

import { SignInButton, SignOutButton } from "@clerk/nextjs";
import {
  ArrowRight,
  FolderKanban,
  LayoutGrid,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useActionState, useState } from "react";
import { createWorkspace } from "@/server/actions/workspace";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
}

interface ConsoleClientProps {
  isAuthenticated: boolean;
  userWorkspaces: WorkspaceItem[];
}

interface ActionState {
  error: string | null;
  success: string | null;
}

export function ConsoleClient({
  isAuthenticated,
  userWorkspaces,
}: ConsoleClientProps) {
  const [slugPrefix, setSlugPrefix] = useState("");

  const [createState, createAction, createPending] = useActionState(
    async (
      _prevState: ActionState,
      formData: FormData,
    ): Promise<ActionState> => {
      const name = formData.get("name") as string;
      const slug = formData.get("slug") as string;

      if (!name || !slug) {
        return { error: "Name and Slug are required", success: null };
      }

      // Slug validation (alphanumeric and dashes only)
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return {
          error:
            "Slug must contain only lowercase letters, numbers, and dashes",
          success: null,
        };
      }

      try {
        const res = await createWorkspace({ name, slug });
        if (res.error) {
          return { error: res.error, success: null };
        }

        // Successful workspace creation: redirect to subdomain context!
        const host = window.location.host;
        const protocol = window.location.protocol;
        const parts = host.split(".");

        let redirectUrl = "";
        if (parts.length > 2) {
          parts[0] = slug;
          redirectUrl = `${protocol}//${parts.join(".")}`;
        } else {
          redirectUrl = `${protocol}//${slug}.${host}`;
        }

        window.location.href = redirectUrl;
        return { success: "Redirecting...", error: null };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create workspace";
        return { error: message, success: null };
      }
    },
    { error: null, success: null } as ActionState,
  );

  const getWorkspaceUrl = (slug: string) => {
    if (typeof window === "undefined") return "";
    const host = window.location.host;
    const protocol = window.location.protocol;
    const parts = host.split(".");

    if (parts.length > 2) {
      parts[0] = slug;
      return `${protocol}//${parts.join(".")}`;
    }
    return `${protocol}//${slug}.${host}`;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlugPrefix(generatedSlug);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-5xl mx-auto w-full">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          Next.js 15 & Neon Postgres RLS
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-450 bg-clip-text text-transparent font-sans">
          Multi-Tenant SaaS Starter
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          A portfolio-grade boilerplate featuring true row-level security (RLS)
          data isolation, subdomain rewriting, Clerk authentication, tRPC v11
          APIs, and Stripe billing.
        </p>
      </section>

      {/* Main console content */}
      {!isAuthenticated ? (
        <div className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-xl text-center space-y-6 mt-6">
          <h2 className="text-lg font-semibold text-zinc-200">Get Started</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Sign in to create a workspace and experience isolated tenant
            environments.
          </p>
          <SignInButton>
            <button
              type="button"
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none"
            >
              Sign In to Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignInButton>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {/* Workspaces List */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-emerald-400" />
              Your Workspaces ({userWorkspaces.length})
            </h2>

            {userWorkspaces.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center">
                <LayoutGrid className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-zinc-300">
                  No workspaces found
                </h3>
                <p className="text-xs text-zinc-550 mt-1">
                  Create your first workspace context using the form.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userWorkspaces.map((ws) => (
                  <a
                    key={ws.id}
                    href={getWorkspaceUrl(ws.slug)}
                    className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-850/30 transition-all group"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-zinc-200 truncate">
                        {ws.name}
                      </h3>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {ws.slug}.lvh.me
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Enter
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Create Workspace Form */}
          <section className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-5 h-fit">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create New Workspace
            </h2>

            <form action={createAction} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-xs text-zinc-400 font-medium"
                >
                  Workspace Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  placeholder="Acme Corp"
                  onChange={handleNameChange}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="slug"
                  className="text-xs text-zinc-400 font-medium"
                >
                  Subdomain Slug
                </label>
                <div className="flex rounded-lg bg-zinc-950 border border-zinc-800 focus-within:border-zinc-700 overflow-hidden transition-colors">
                  <input
                    type="text"
                    name="slug"
                    id="slug"
                    required
                    placeholder="acme"
                    value={slugPrefix}
                    onChange={(e) =>
                      setSlugPrefix(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-100 focus:outline-none"
                  />
                  <span className="bg-zinc-900/60 border-l border-zinc-800 text-xs text-zinc-500 font-semibold px-3 flex items-center select-none font-mono">
                    .lvh.me
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={createPending}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-zinc-950 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-1.5 focus:outline-none"
              >
                <Rocket className="w-4 h-4 shrink-0" />
                {createPending ? "Creating Workspace..." : "Create and Launch"}
              </button>

              {createState.error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {createState.error}
                </div>
              )}
              {createState.success && (
                <p className="text-xs text-emerald-400 font-medium">
                  {createState.success}
                </p>
              )}
            </form>
          </section>
        </div>
      )}

      {/* Sign Out Trigger when authenticated */}
      {isAuthenticated && (
        <div className="mt-12 text-center">
          <SignOutButton>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-zinc-400 underline transition-colors"
            >
              Sign out of account
            </button>
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
