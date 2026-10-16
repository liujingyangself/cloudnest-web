import {
  Box,
  Button,
  Center,
  Image,
  Spinner,
  Text,
  VStack,
} from "@hope-ui/solid"
import { createSignal, Match, onCleanup, Show, Switch } from "solid-js"
import { useT } from "~/hooks"
import { PResp } from "~/types"
import {
  clearPendingWxMini,
  handleRespWithoutAuthAndNotify,
  loadPendingWxMini,
  r,
  savePendingWxMini,
  WxMiniPending,
  WxMiniPurpose,
} from "~/utils"
import { isWechat } from "~/utils/compatibility"

export interface WxMiniTicket {
  ticket: string
  poll_key: string
  qr_image: string
  expires_in: number
}

type Status =
  | "loading"
  | "pending"
  | "scanned"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "error"

interface PollResult {
  status: Exclude<Status, "loading" | "error">
  token?: string
}

// How often to ask whether the code was scanned. The server keeps a ticket
// for five minutes, so this is at most ~150 cheap requests per code.
const POLL_INTERVAL_MS = 2000

/**
 * A mini program code the user scans with WeChat, polled until the scan is
 * confirmed in the mini program. `create` asks the server for a ticket (sign
 * in, or bind the current account); `onToken` receives the session token.
 *
 * The code is remembered for the tab, so a reload picks it up again instead
 * of showing a new one (see wxmini-pending). `resume` lists which remembered
 * codes this page may take over besides its own `purpose`.
 */
export const WxMiniQR = (props: {
  purpose: WxMiniPurpose
  resume?: WxMiniPurpose[]
  create: () => PResp<WxMiniTicket>
  onToken: (token: string) => void
  hint: string
}) => {
  const t = useT()
  const [status, setStatus] = createSignal<Status>("loading")
  const [error, setError] = createSignal("")
  const [image, setImage] = createSignal("")
  const [secondsLeft, setSecondsLeft] = createSignal(0)

  let ticket: Pick<WxMiniTicket, "ticket" | "poll_key"> | undefined
  let pollTimer: number | undefined
  let countdownTimer: number | undefined
  let disposed = false

  const stop = () => {
    window.clearTimeout(pollTimer)
    window.clearInterval(countdownTimer)
  }

  // The code is done with: nothing left to pick up after a reload.
  const finish = () => {
    stop()
    clearPendingWxMini()
  }

  const requestPoll = async (
    t: Pick<WxMiniTicket, "ticket" | "poll_key">,
  ): Promise<{ code: number; message: string; data?: PollResult }> =>
    r.post("/auth/wxmini/poll", { ticket: t.ticket, poll_key: t.poll_key })

  const poll = async () => {
    if (disposed || !ticket) return
    // A background tab has nobody looking at the code; resume on return.
    if (document.hidden) {
      pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
      return
    }
    const current = ticket
    const resp = await requestPoll(current)
    if (disposed || ticket !== current) return
    if (resp.code !== 200 || !resp.data) {
      // e.g. the device limit refused this sign-in: show why, offer retry.
      finish()
      setError(resp.message)
      setStatus("error")
      return
    }
    const data = resp.data
    setStatus(data.status)
    if (data.status === "confirmed" && data.token) {
      finish()
      props.onToken(data.token)
      return
    }
    if (data.status === "cancelled" || data.status === "expired") {
      finish()
      return
    }
    pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
  }

  const show = (p: WxMiniPending, delayMs: number) => {
    ticket = { ticket: p.ticket, poll_key: p.poll_key }
    setImage(p.qr_image)
    setSecondsLeft(Math.max(1, Math.ceil((p.expires_at - Date.now()) / 1000)))
    setStatus("pending")
    countdownTimer = window.setInterval(() => {
      const left = secondsLeft() - 1
      setSecondsLeft(left)
      if (left <= 0) {
        finish()
        setStatus("expired")
      }
    }, 1000)
    pollTimer = window.setTimeout(poll, delayMs)
  }

  // A remembered code from another page (the binding page's, seen from the
  // login page after binding signed this tab out) is only worth keeping when
  // the user is already acting on it in the mini program; an untouched one
  // would bind instead of sign in, so a fresh login code replaces it. The
  // look itself collects the session when the code is already confirmed —
  // the server hands that out once — so it is used right here.
  const adoptForeign = async (p: WxMiniPending) => {
    const resp = await requestPoll(p)
    if (disposed) return true
    const status = resp.code === 200 ? resp.data?.status : undefined
    if (status === "confirmed" && resp.data?.token) {
      clearPendingWxMini()
      setStatus("confirmed")
      props.onToken(resp.data.token)
      return true
    }
    if (status !== "scanned") {
      clearPendingWxMini()
      return false
    }
    show(p, POLL_INTERVAL_MS)
    setStatus("scanned")
    return true
  }

  const resumePending = async () => {
    const p = loadPendingWxMini(props.resume ?? [props.purpose])
    if (!p) return false
    if (p.purpose !== props.purpose) return adoptForeign(p)
    show(p, 0)
    return true
  }

  const start = async (fresh = false) => {
    stop()
    ticket = undefined
    setStatus("loading")
    setError("")
    if (fresh) clearPendingWxMini()
    else if (await resumePending()) return
    const resp = await props.create()
    if (disposed) return
    handleRespWithoutAuthAndNotify(
      resp,
      (data) => {
        const pending: WxMiniPending = {
          purpose: props.purpose,
          ticket: data.ticket,
          poll_key: data.poll_key,
          qr_image: data.qr_image,
          expires_at: Date.now() + data.expires_in * 1000,
        }
        savePendingWxMini(pending)
        show(pending, POLL_INTERVAL_MS)
      },
      (msg) => {
        setError(msg)
        setStatus("error")
      },
    )
  }

  start()
  onCleanup(() => {
    disposed = true
    stop()
  })

  const overlay = () =>
    ["scanned", "confirmed", "cancelled", "expired", "error"].includes(status())

  return (
    <VStack spacing="$3" w="$full">
      <Box
        position="relative"
        boxSize="200px"
        rounded="$lg"
        overflow="hidden"
        bg="white"
        borderWidth="1px"
        borderColor="$neutral6"
      >
        <Show
          when={status() !== "loading"}
          fallback={
            <Center h="$full">
              <Spinner />
            </Center>
          }
        >
          <Show when={image()}>
            <Image
              src={image()}
              alt={t("wxmini.qr_alt")}
              boxSize="200px"
              css={{ filter: overlay() ? "blur(3px)" : "none" }}
            />
          </Show>
          <Show when={overlay()}>
            <Center
              position="absolute"
              top="0"
              right="0"
              bottom="0"
              left="0"
              bg="rgba(255,255,255,0.85)"
              color="$neutral12"
              p="$3"
            >
              <VStack spacing="$2">
                <Switch>
                  <Match when={status() === "scanned"}>
                    <Text fontWeight="$semibold" color="$success11">
                      {t("wxmini.scanned")}
                    </Text>
                    <Text fontSize="$sm" textAlign="center">
                      {t("wxmini.confirm_in_mini")}
                    </Text>
                  </Match>
                  <Match when={status() === "confirmed"}>
                    <Spinner />
                    <Text fontSize="$sm">{t("wxmini.signing_in")}</Text>
                  </Match>
                  <Match when={status() !== "scanned"}>
                    <Text fontSize="$sm" textAlign="center">
                      {status() === "error"
                        ? error()
                        : status() === "cancelled"
                          ? t("wxmini.cancelled")
                          : t("wxmini.expired")}
                    </Text>
                    <Button size="sm" onClick={() => start(true)}>
                      {t("wxmini.refresh")}
                    </Button>
                  </Match>
                </Switch>
              </VStack>
            </Center>
          </Show>
        </Show>
      </Box>
      <Text fontSize="$sm" color="$neutral11" textAlign="center">
        {props.hint}
      </Text>
      <Show when={isWechat}>
        <Text fontSize="$sm" color="$warning11" textAlign="center">
          {t("wxmini.in_wechat_tip")}
        </Text>
      </Show>
      <Show when={status() === "pending" && secondsLeft() > 0}>
        <Text fontSize="$xs" color="$neutral9">
          {t("wxmini.expires_in", { n: String(secondsLeft()) })}
        </Text>
      </Show>
    </VStack>
  )
}
