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
import { handleRespWithoutAuthAndNotify, r } from "~/utils"

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
 */
export const WxMiniQR = (props: {
  create: () => PResp<WxMiniTicket>
  onToken: (token: string) => void
  hint: string
}) => {
  const t = useT()
  const [status, setStatus] = createSignal<Status>("loading")
  const [error, setError] = createSignal("")
  const [image, setImage] = createSignal("")
  const [secondsLeft, setSecondsLeft] = createSignal(0)

  let ticket: WxMiniTicket | undefined
  let pollTimer: number | undefined
  let countdownTimer: number | undefined
  let disposed = false

  const stop = () => {
    window.clearTimeout(pollTimer)
    window.clearInterval(countdownTimer)
  }

  const poll = async () => {
    if (disposed || !ticket) return
    // A background tab has nobody looking at the code; resume on return.
    if (document.hidden) {
      pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
      return
    }
    const current = ticket
    const resp: any = await r.post("/auth/wxmini/poll", {
      ticket: current.ticket,
      poll_key: current.poll_key,
    })
    if (disposed || ticket !== current) return
    if (resp.code !== 200) {
      // e.g. the device limit refused this sign-in: show why, offer retry.
      stop()
      setError(resp.message)
      setStatus("error")
      return
    }
    const data = resp.data as PollResult
    setStatus(data.status)
    if (data.status === "confirmed" && data.token) {
      stop()
      props.onToken(data.token)
      return
    }
    if (data.status === "cancelled" || data.status === "expired") {
      stop()
      return
    }
    pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
  }

  const start = async () => {
    stop()
    ticket = undefined
    setStatus("loading")
    setError("")
    const resp = await props.create()
    if (disposed) return
    handleRespWithoutAuthAndNotify(
      resp,
      (data) => {
        ticket = data
        setImage(data.qr_image)
        setSecondsLeft(data.expires_in)
        setStatus("pending")
        countdownTimer = window.setInterval(() => {
          const left = secondsLeft() - 1
          setSecondsLeft(left)
          if (left <= 0) {
            stop()
            setStatus("expired")
          }
        }, 1000)
        pollTimer = window.setTimeout(poll, POLL_INTERVAL_MS)
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
                    <Button size="sm" onClick={start}>
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
      <Show when={status() === "pending" && secondsLeft() > 0}>
        <Text fontSize="$xs" color="$neutral9">
          {t("wxmini.expires_in", { n: String(secondsLeft()) })}
        </Text>
      </Show>
    </VStack>
  )
}
