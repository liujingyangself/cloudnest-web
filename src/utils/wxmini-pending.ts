// Remembers the mini program code a page is waiting on, so a reload can keep
// polling it instead of asking for a new one. Opened inside WeChat on a
// phone, the page is reloaded when the user comes back from the mini program;
// without this the code they just confirmed is dropped and they are shown a
// fresh one, over and over.
//
// sessionStorage is per tab, which is exactly the scope of a code: another
// tab never picks up a login it did not start.

export type WxMiniPurpose = "login" | "bind"

export interface WxMiniPending {
  purpose: WxMiniPurpose
  ticket: string
  poll_key: string
  qr_image: string
  // Epoch milliseconds after which the server no longer knows the ticket.
  expires_at: number
}

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">

const STORAGE_KEY = "wxmini_pending"

const PURPOSES: readonly WxMiniPurpose[] = ["login", "bind"]

const isPending = (v: unknown): v is WxMiniPending => {
  if (!v || typeof v !== "object") return false
  const p = v as Record<string, unknown>
  return (
    PURPOSES.includes(p.purpose as WxMiniPurpose) &&
    typeof p.ticket === "string" &&
    p.ticket !== "" &&
    typeof p.poll_key === "string" &&
    p.poll_key !== "" &&
    typeof p.qr_image === "string" &&
    typeof p.expires_at === "number"
  )
}

// Storage access can throw (private mode, blocked site data); losing the
// memory only brings back the old behaviour, so failures are not reported.
const sessionKV = (): KV | undefined => {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

export const savePendingWxMini = (
  pending: WxMiniPending,
  kv: KV | undefined = sessionKV(),
) => {
  try {
    kv?.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // Quota or access error: the code simply won't survive a reload.
  }
}

export const clearPendingWxMini = (kv: KV | undefined = sessionKV()) => {
  try {
    kv?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unreachable.
  }
}

/**
 * The remembered code if it is for one of `purposes` and still has at least
 * `minLeftMs` to live. Anything else stored there is stale and is removed.
 */
export const loadPendingWxMini = (
  purposes: readonly WxMiniPurpose[],
  now: number = Date.now(),
  kv: KV | undefined = sessionKV(),
  minLeftMs = 3000,
): WxMiniPending | undefined => {
  let raw: string | null = null
  try {
    raw = kv?.getItem(STORAGE_KEY) ?? null
  } catch {
    return undefined
  }
  if (!raw) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }
  if (!isPending(parsed) || parsed.expires_at - now < minLeftMs) {
    clearPendingWxMini(kv)
    return undefined
  }
  // Kept for the page it belongs to: the binding page's code must not be
  // dropped just because the login page looked first.
  if (!purposes.includes(parsed.purpose)) return undefined
  return parsed
}
