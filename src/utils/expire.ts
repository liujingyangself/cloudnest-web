// Account expiry helpers. The server stores an absolute deadline (RFC3339) and
// a null means the account never expires.

/** Whether the deadline has passed. A null deadline never expires. */
export const isExpired = (expiresAt?: string | null): boolean => {
  if (!expiresAt) return false
  const deadline = new Date(expiresAt).getTime()
  if (Number.isNaN(deadline)) return false
  return deadline <= Date.now()
}

/** Whole days left before the deadline, floored at 0. */
export const daysUntilExpire = (expiresAt?: string | null): number => {
  if (!expiresAt) return Infinity
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (Number.isNaN(ms)) return Infinity
  return Math.max(0, Math.ceil(ms / 86400000))
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Format a deadline for an `<input type="datetime-local">`, which only accepts
 * `YYYY-MM-DDTHH:mm` in the browser's own timezone.
 */
export const toDatetimeLocal = (expiresAt?: string | null): string => {
  if (!expiresAt) return ""
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return ""
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** Turn a `datetime-local` value back into an absolute timestamp. */
export const fromDatetimeLocal = (value: string): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * The deadline `days` from now, at the end of that local day — an admin who
 * grants "30 days" means through the whole of that thirtieth day.
 */
export const deadlineInDays = (days: number, from?: string | null): string => {
  const base = from ? new Date(from) : new Date()
  const start =
    !from || Number.isNaN(base.getTime()) || base.getTime() < Date.now()
      ? new Date()
      : base
  const date = new Date(start)
  date.setDate(date.getDate() + days)
  date.setHours(23, 59, 59, 0)
  return date.toISOString()
}

/** Format a timestamp for an `<input type="date">` (browser's timezone). */
export const toDateInput = (value?: string | null): string => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`
}

/** Turn a `date` input value into the start of that local day. */
export const fromDateInput = (value: string): string | null => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
