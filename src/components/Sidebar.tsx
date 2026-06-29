"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

interface SidebarProps {
  currentWorkspace: WorkspaceInfo;
  workspaces: WorkspaceInfo[];
}

export function Sidebar({ currentWorkspace, workspaces }: SidebarProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Helper to construct domain-based workspace switching URLs
  const handleWorkspaceChange = (slug: string) => {
    if (slug === currentWorkspace.slug) {
      setDropdownOpen(false);
      return;
    }
    const host = window.location.host;
    const protocol = window.location.protocol;
    const parts = host.split(".");

    let targetUrl = "";
    if (parts.length > 2) {
      // Subdomain active (e.g., [tenant].lvh.me:3000)
      parts[0] = slug;
      targetUrl = `${protocol}//${parts.join(".")}`;
    } else {
      // Standard domain or localhost (e.g., lvh.me:3000)
      targetUrl = `${protocol}//${slug}.${host}`;
    }

    window.location.href = targetUrl;
  };

  const pathPrefix = pathname.startsWith(`/${currentWorkspace.slug}`)
    ? `/${currentWorkspace.slug}`
    : "";

  const navItems = [
    {
      name: "Dashboard",
      href: `${pathPrefix}/`,
      icon: LayoutDashboard,
    },
    {
      name: "Team Members",
      href: `${pathPrefix}/members`,
      icon: Users,
    },
    {
      name: "Billing Settings",
      href: `${pathPrefix}/billing`,
      icon: CreditCard,
    },
  ];

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full text-zinc-300">
      {/* Workspace Switcher */}
      <div className="p-4 border-b border-zinc-800 relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between bg-zinc-950 px-3 py-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all text-left focus:outline-none"
        >
          <div className="flex flex-col truncate">
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
              Workspace
            </span>
            <span className="text-sm text-zinc-100 font-medium truncate">
              {currentWorkspace.name}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />
        </button>

        {dropdownOpen && (
          <>
            {/* biome-ignore lint/a11y/useButtonType: backdrop */}
            <button
              onClick={() => setDropdownOpen(false)}
              className="fixed inset-0 z-10 w-full h-full cursor-default bg-transparent"
              aria-label="Close workspace dropdown"
            />
            <div className="absolute left-4 right-4 mt-2 bg-zinc-950 border border-zinc-850 rounded-lg shadow-xl py-1.5 z-20 max-h-60 overflow-y-auto">
              <div className="px-3 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleWorkspaceChange(ws.slug)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800/60 transition-colors flex items-center justify-between ${
                    ws.slug === currentWorkspace.slug
                      ? "text-zinc-100 font-medium bg-zinc-800/30"
                      : "text-zinc-400"
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                </button>
              ))}
              <div className="border-t border-zinc-900 my-1" />
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  const host = window.location.host;
                  const protocol = window.location.protocol;
                  const parts = host.split(".");

                  // Redirect to main console to create workspace
                  let consoleUrl = "";
                  if (parts.length > 2) {
                    parts.shift(); // Remove the subdomain part
                    consoleUrl = `${protocol}//${parts.join(".")}`;
                  } else {
                    consoleUrl = `${protocol}//${host}`;
                  }
                  window.location.href = consoleUrl;
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Workspace
              </button>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5">
        {navItems.map((item) => {
          const hrefNormalized = item.href.replace(/\/$/, "");
          const pathnameNormalized = pathname.replace(/\/$/, "");
          // Check active state (if dashboard root matching or prefix matching)
          const isActive =
            hrefNormalized === pathPrefix
              ? pathnameNormalized === pathPrefix
              : pathnameNormalized.startsWith(hrefNormalized);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-zinc-800 text-zinc-100 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                  isActive
                    ? "text-zinc-100"
                    : "text-zinc-500 group-hover:text-zinc-400"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox:
                  "w-8 h-8 rounded-full border border-zinc-800",
              },
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-zinc-500 font-medium">
              Signed in as
            </span>
            <span className="text-sm font-semibold text-zinc-200 truncate leading-snug">
              {currentWorkspace.name} Member
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
