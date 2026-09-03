import { createSignal, JSXElement, lazy, Match, Switch } from "solid-js"
import { Error, FullScreenLoading } from "~/components"
import { useFetch, useT } from "~/hooks"
import { me, Me, setMe } from "~/store"
import { PResp } from "~/types"
import { r, handleResp, isExpired } from "~/utils"

const Expired = lazy(() => import("~/pages/expired"))

const MustUser = (props: { children: JSXElement }) => {
  const t = useT()
  const [loading, data] = useFetch((): PResp<Me> => r.get("/me"))
  const [err, setErr] = createSignal<string>()
  ;(async () => {
    handleResp(await data(), setMe, setErr)
  })()
  return (
    <Switch fallback={props.children}>
      <Match when={loading()}>
        <FullScreenLoading />
      </Match>
      <Match when={err() !== undefined}>
        <Error msg={t("home.get_current_user_failed") + err()} />
      </Match>
      {/* The server already refuses everything but /me, /auth and /billing for
          an expired account; rendering the file browser would just fill the
          screen with permission errors. */}
      <Match when={isExpired(me().expires_at)}>
        <Expired />
      </Match>
    </Switch>
  )
}

export { MustUser }
