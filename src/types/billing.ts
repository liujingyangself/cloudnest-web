// Membership plans and redeem codes. Mirrors internal/model/plan.go and
// internal/model/redeem_code.go on the server.

export interface Plan {
  id: number
  name: string
  description: string
  /** Monthly price in CNY. */
  price: number
  /** Annual price in CNY, usually discounted. */
  annual_price: number
  /** Default subscription length in days. */
  duration: number
  /** -1 means unlimited. */
  storage_quota_gb: number
  /** -1 means unlimited. */
  monthly_bandwidth_gb: number
  max_concurrent_downloads: number
  max_devices: number
  /** 0 means no plan-level speed cap; the global limit still applies. */
  speed_limit_bytes_per_sec: number
  can_download: boolean
  enabled: boolean
  sort_order: number
}

export interface RedeemCode {
  id: number
  code: string
  plan_id: number
  /** Days of subscription this code grants. */
  duration: number
  /** 0 means unused. */
  used_by: number
  used_at: string | null
  /** null means the code itself never expires. */
  expires_at: string | null
  batch_label: string
  created_at: string
}

export const emptyPlan = (): Plan => ({
  id: 0,
  name: "",
  description: "",
  price: 0,
  annual_price: 0,
  duration: 30,
  storage_quota_gb: -1,
  monthly_bandwidth_gb: -1,
  max_concurrent_downloads: 0,
  max_devices: 0,
  speed_limit_bytes_per_sec: 0,
  can_download: true,
  enabled: true,
  sort_order: 0,
})

/** -1 is stored for "unlimited"; the forms show it as an explicit choice. */
export const UNLIMITED = -1
