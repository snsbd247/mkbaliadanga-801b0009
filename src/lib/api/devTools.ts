import { api } from "./client";

export type FileEntry = {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number | null;
  skipped: boolean;
  secret: boolean;
};

export type GitStatus = {
  is_repo: boolean;
  remote_url: string | null;
  branch: string | null;
  last_commit: string | null;
};

export type RemoteCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export type DevAuditLog = {
  id: string;
  action: string;
  repo_url: string | null;
  status: string | null;
  note: string | null;
  created_at: string;
};

export type GitOpOptions = { signal?: AbortSignal; timeout?: number };

export const DevToolsApi = {
  list: (path = "") =>
    api.get<{ path: string; entries: FileEntry[] }>("/dev/files", { params: { path } }).then((r) => r.data),
  read: (path: string) =>
    api
      .post<{ path: string; binary: boolean; content: string | null; size: number }>("/dev/files/read", { path })
      .then((r) => r.data),
  write: (path: string, content: string) =>
    api.post<{ ok: boolean; path: string; size: number }>("/dev/files/write", { path, content }).then((r) => r.data),

  gitStatus: () => api.get<GitStatus>("/dev/git/status").then((r) => r.data),
  checkRemote: (url: string) =>
    api
      .post<{ ok: boolean; checks: RemoteCheck[]; output: string }>("/dev/git/check-remote", { url })
      .then((r) => r.data),
  setRemote: (url: string) =>
    api
      .post<{ ok: boolean; remote_url: string; output?: string }>("/dev/git/remote", { url })
      .then((r) => r.data),
  pull: (branch?: string, opts?: GitOpOptions) =>
    api
      .post<{ ok: boolean; output: string }>("/dev/git/pull", branch ? { branch } : {}, {
        signal: opts?.signal,
        timeout: opts?.timeout,
      })
      .then((r) => r.data),
  dryRun: (branch?: string, opts?: GitOpOptions) =>
    api
      .post<{ ok: boolean; branch: string; incoming_count: number; output: string }>(
        "/dev/git/dry-run",
        branch ? { branch } : {},
        { signal: opts?.signal, timeout: opts?.timeout },
      )
      .then((r) => r.data),
  rollback: () =>
    api
      .post<{ ok: boolean; last_commit: string | null; output: string }>("/dev/git/rollback", {})
      .then((r) => r.data),
  auditLogs: () => api.get<{ logs: DevAuditLog[] }>("/dev/git/logs").then((r) => r.data),
};
