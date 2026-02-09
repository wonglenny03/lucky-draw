// 开发时用相对路径走 Vite 代理；生产环境需配置 VITE_API_URL
const API_BASE = ((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ?? "";

/** 收到 401 时调用，用于自动退出到登录页 */
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

function getOptions(method: string, body?: unknown): RequestInit {
  const opts: RequestInit = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return opts;
}

export interface MeResponse {
  userId: number;
  username: string;
}

export async function apiMe(): Promise<MeResponse | null> {
  const res = await fetch(`${API_BASE}/api/me`, getOptions("GET"));
  if (res.status === 401) {
    onUnauthorized?.();
    return null;
  }
  if (!res.ok) throw new Error("获取用户信息失败");
  return res.json();
}

export async function apiLogin(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/login`, getOptions("POST", { username, password }));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "登录失败");
  }
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API_BASE}/api/logout`, getOptions("POST"));
}

export async function apiGetDrawState(): Promise<import("../types").AppState> {
  const res = await fetch(`${API_BASE}/api/draw-state`, getOptions("GET"));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error("获取抽奖状态失败");
  return res.json();
}

export async function apiPutDrawState(state: import("../types").AppState): Promise<void> {
  const res = await fetch(`${API_BASE}/api/draw-state`, getOptions("PUT", state));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error("保存失败");
}

export interface DrawResponse {
  winners: import("../types").Winner[];
  state: import("../types").AppState;
}

export async function apiDraw(params: {
  currentPrizeId: string;
  isExtraMode: boolean;
  participantIds: string[];
  prizeSnapshot: import("../types").Prize;
}): Promise<DrawResponse> {
  const res = await fetch(`${API_BASE}/api/draw`, getOptions("POST", params));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "抽奖失败");
  }
  return res.json();
}

export async function apiDrawReset(): Promise<import("../types").AppState> {
  const res = await fetch(`${API_BASE}/api/draw-reset`, getOptions("POST"));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error("重置失败");
  return res.json();
}

/** 获取服务端默认配置（奖项 + 人员） */
export async function apiGetDefaultConfig(): Promise<import("../types").AppState> {
  const res = await fetch(`${API_BASE}/api/default-config`, getOptions("GET"));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error("获取默认配置失败");
  return res.json();
}

/** 恢复为默认配置并保存到数据库（奖项、人员重置，中奖记录清空） */
export async function apiResetToDefaultConfig(): Promise<import("../types").AppState> {
  const res = await fetch(`${API_BASE}/api/draw-reset-to-default`, getOptions("POST"));
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) throw new Error("恢复默认失败");
  return res.json();
}

/** 上传图片到服务器，返回可访问的 URL */
export async function apiUploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new Error("未登录");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "上传失败");
  }
  const data = await res.json();
  const url = data.url as string;
  if (!url) throw new Error("上传失败");
  return url.startsWith("http") ? url : (API_BASE ? `${API_BASE}${url}` : url);
}
