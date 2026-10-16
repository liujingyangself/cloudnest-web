// Run with: pnpm test (node --test; Node strips the TypeScript types itself).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  clearPendingWxMini,
  loadPendingWxMini,
  savePendingWxMini,
} from "../src/utils/wxmini-pending.ts"

const memoryKV = () => {
  const m = new Map()
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  }
}

const NOW = 1_700_000_000_000
const pending = (over = {}) => ({
  purpose: "login",
  ticket: "t1",
  poll_key: "k1",
  qr_image: "data:image/png;base64,AAAA",
  expires_at: NOW + 60_000,
  ...over,
})

test("returns a saved code that is still valid", () => {
  const kv = memoryKV()
  savePendingWxMini(pending(), kv)
  assert.deepEqual(loadPendingWxMini(["login"], NOW, kv), pending())
})

test("drops a code that has expired or is about to", () => {
  const kv = memoryKV()
  savePendingWxMini(pending({ expires_at: NOW + 1000 }), kv)
  assert.equal(loadPendingWxMini(["login"], NOW, kv), undefined)
  assert.equal(kv.m.size, 0)
})

test("leaves another page's code in place", () => {
  const kv = memoryKV()
  savePendingWxMini(pending({ purpose: "bind" }), kv)
  assert.equal(loadPendingWxMini(["login"], NOW, kv), undefined)
  assert.equal(kv.m.size, 1)
  assert.equal(loadPendingWxMini(["login", "bind"], NOW, kv)?.purpose, "bind")
})

test("removes malformed entries", () => {
  for (const bad of [
    "not json",
    "null",
    JSON.stringify({ ...pending(), ticket: "" }),
    JSON.stringify({ ...pending(), purpose: "steal" }),
    JSON.stringify({ ...pending(), expires_at: "soon" }),
  ]) {
    const kv = memoryKV()
    kv.setItem("wxmini_pending", bad)
    assert.equal(loadPendingWxMini(["login", "bind"], NOW, kv), undefined, bad)
    assert.equal(kv.m.size, 0, bad)
  }
})

test("clear removes the code", () => {
  const kv = memoryKV()
  savePendingWxMini(pending(), kv)
  clearPendingWxMini(kv)
  assert.equal(loadPendingWxMini(["login"], NOW, kv), undefined)
})

test("storage that throws is treated as empty", () => {
  const boom = () => {
    throw new Error("blocked")
  }
  const kv = { getItem: boom, setItem: boom, removeItem: boom }
  assert.doesNotThrow(() => savePendingWxMini(pending(), kv))
  assert.equal(loadPendingWxMini(["login"], NOW, kv), undefined)
  assert.doesNotThrow(() => clearPendingWxMini(kv))
})

test("missing storage is treated as empty", () => {
  assert.equal(loadPendingWxMini(["login"], NOW, undefined), undefined)
})
