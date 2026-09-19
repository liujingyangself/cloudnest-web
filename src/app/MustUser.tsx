import { createSignal, JSXElement, lazy, Match, Switch } from "solid-js"
import { Error, FullScreenLoading } from "~/components"
import { useFetch, useT } from "~/hooks"
import { getSettingBool, me, Me, setMe } from "~/store"
import { PResp, UserMethods } from "~/types"
import { r, handleResp, isExpired } from "~/utils"

const Expired = lazy(() => import("~/pages/expired"))
const BindWechat = lazy(() => import("~/pages/bind-wechat"))

// Mirrors the server's rule (User.MustBindWxMini): admin and guest never have
// to bind.
const mustBindWechat = (u: Me) =>
  getSettingBool("wxmini_login_enabled") &&
  getSettingBool("wxmini_force_binding") &&
  !u.wx_mini_openid &&
  !UserMethods.is_admin(u) &&
  !UserMethods.is_guest(u)

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
      {/* Binding comes first: it is what stops a shared password, and an
          expired account can still bind (the server allows /me for both). */}
      <Match when={mustBindWechat(me())}>
        <BindWechat />
      </Match>
      <Match when={isExpired(me().expires_at)}>
        <Expired />
      </Match>
    </Switch>
  )
}

export { MustUser }
