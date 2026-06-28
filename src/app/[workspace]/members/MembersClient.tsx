"use client";

import { Mail, Shield, UserMinus, UserPlus } from "lucide-react";
import { useActionState, useTransition } from "react";
import {
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/server/actions/workspace";

interface Member {
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresAt: Date;
}

interface MembersClientProps {
  workspaceSlug: string;
  currentUserId: string;
  initialMembers: Member[];
  initialInvitations: Invitation[];
}

interface ActionState {
  error: string | null;
  success: string | null;
}

export function MembersClient({
  workspaceSlug,
  currentUserId,
  initialMembers,
  initialInvitations,
}: MembersClientProps) {
  const [isPending, startTransition] = useTransition();

  // Invite action state with explicit typing
  const [inviteState, inviteAction, invitePending] = useActionState(
    async (
      _prevState: ActionState,
      formData: FormData,
    ): Promise<ActionState> => {
      const email = formData.get("email") as string;
      const role = formData.get("role") as "admin" | "member";

      if (!email) return { error: "Email is required", success: null };

      try {
        const res = await inviteMember({ workspaceSlug, email, role });
        if (res.error) {
          return { error: res.error, success: null };
        }
        return { success: "Invitation sent successfully!", error: null };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send invitation";
        return {
          error: message,
          success: null,
        };
      }
    },
    { error: null, success: null } as ActionState,
  );

  const handleRoleChange = async (userId: string, role: "admin" | "member") => {
    startTransition(async () => {
      try {
        const res = await updateMemberRole({ workspaceSlug, userId, role });
        if (res.error) alert(res.error);
        else window.location.reload();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update role";
        alert(message);
      }
    });
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    startTransition(async () => {
      try {
        const res = await removeMember({ workspaceSlug, userId });
        if (res.error) alert(res.error);
        else window.location.reload();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove member";
        alert(message);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Invite Member Section */}
      <section className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5 text-emerald-400" />
          Invite Team Member
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Send an invitation to join this workspace. Members will have
          RLS-scoped database access.
        </p>

        <form action={inviteAction} className="space-y-4 max-w-2xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-zinc-500" />
              </div>
              <input
                type="email"
                name="email"
                id="email"
                placeholder="colleague@company.com"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div className="w-full sm:w-40">
              <select
                name="role"
                id="role"
                defaultValue="member"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={invitePending}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-600/50 text-zinc-950 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 focus:outline-none"
            >
              {invitePending ? "Sending..." : "Send Invite"}
            </button>
          </div>

          {inviteState.error && (
            <p className="text-sm text-rose-400 font-medium">
              {inviteState.error}
            </p>
          )}
          {inviteState.success && (
            <p className="text-sm text-emerald-400 font-medium">
              {inviteState.success}
            </p>
          )}
        </form>
      </section>

      {/* Members List */}
      <section className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-6">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Active Members ({initialMembers.length})
        </h2>

        <div className="divide-y divide-zinc-800/60 overflow-hidden">
          {initialMembers.map((member) => (
            <div
              key={member.user.id}
              className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* biome-ignore lint/performance/noImgElement: Clerk avatar dynamic fetch */}
                <img
                  src={
                    member.user.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${member.user.name}`
                  }
                  alt={member.user.name || "User Avatar"}
                  className="w-10 h-10 rounded-full border border-zinc-800 bg-zinc-950 object-cover shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-zinc-200 truncate">
                      {member.user.name}
                    </span>
                    {member.user.id === currentUserId && (
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-850 ml-1.5 shrink-0">
                        You
                      </span>
                    )}
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                        member.role === "owner"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : member.role === "admin"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {member.role}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 truncate mt-0.5">
                    {member.user.email}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Role Switcher */}
                {member.role !== "owner" && (
                  <select
                    value={member.role}
                    disabled={member.user.id === currentUserId || isPending}
                    onChange={(e) =>
                      handleRoleChange(
                        member.user.id,
                        e.target.value as "admin" | "member",
                      )
                    }
                    className="bg-zinc-950 border border-zinc-850 hover:border-zinc-750 disabled:opacity-60 text-xs font-semibold uppercase text-zinc-400 rounded px-2.5 py-1.5 focus:outline-none transition-colors"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                )}

                {/* Remove Member Button */}
                <button
                  type="button"
                  disabled={
                    member.role === "owner" ||
                    member.user.id === currentUserId ||
                    isPending
                  }
                  onClick={() => handleRemove(member.user.id)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 disabled:opacity-40 transition-colors rounded-lg hover:bg-rose-500/5 focus:outline-none shrink-0"
                  title="Remove Member"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pending Invitations */}
      {initialInvitations.length > 0 && (
        <section className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            Pending Invitations ({initialInvitations.length})
          </h2>
          <div className="divide-y divide-zinc-800/40">
            {initialInvitations.map((invite) => (
              <div
                key={invite.id}
                className="py-3 flex items-center justify-between first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-sm text-zinc-300 font-medium truncate">
                    {invite.email}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider ml-2 shrink-0">
                    {invite.role}
                  </span>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">
                  Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
