import { Box, Button, Center, Heading, Text, VStack } from "@hope-ui/solid"
import { WxMiniQR, WxMiniTicket } from "~/components"
import { useFetch, useRouter, useT, useTitle } from "~/hooks"
import { me, Me, setMe } from "~/store"
import { PResp } from "~/types"
import { changeToken, handleResp, notify, r } from "~/utils"

/**
 * Shown instead of the site to an account that signed in by password but has
 * not bound WeChat yet, while binding is enforced. The server refuses
 * everything but /me, /auth and /public for such an account, so binding (or
 * signing out) is the only way forward.
 */
const BindWechat = () => {
  const t = useT()
  useTitle(() => t("wxmini.bind_title"))
  const { to } = useRouter()
  const [, reloadMe] = useFetch((): PResp<Me> => r.get("/me"))
  const [loggingOut, logOutReq] = useFetch(
    (): PResp<any> => r.get("/auth/logout"),
  )

  // Binding signs out every other session of the account, this one included,
  // so the server hands back a fresh token to continue with.
  const onToken = async (token: string) => {
    changeToken(token)
    handleResp(await reloadMe(), (data) => {
      setMe(data)
      notify.success(t("wxmini.bind_success"))
    })
  }

  const logOut = async () => {
    await logOutReq()
    changeToken()
    to("/@login")
  }

  return (
    <Center minH="100vh" p="$4">
      <VStack spacing="$4" maxW="$md" w="$full" alignItems="stretch">
        <VStack spacing="$2" alignItems="start">
          <Heading size="xl">{t("wxmini.bind_title")}</Heading>
          <Text color="$neutral11">{t("wxmini.bind_desc")}</Text>
        </VStack>
        <Box p="$3" rounded="$md" bg="$neutral3" color="$neutral11">
          {t("wxmini.bind_account")}: <b>{me().username}</b>
        </Box>
        <Center>
          <WxMiniQR
            create={(): PResp<WxMiniTicket> => r.post("/me/wxmini/bind/create")}
            onToken={onToken}
            hint={t("wxmini.bind_hint")}
          />
        </Center>
        <Text color="$warning11" fontSize="$sm">
          {t("wxmini.bind_warning")}
        </Text>
        <Button
          colorScheme="neutral"
          variant="outline"
          loading={loggingOut()}
          onClick={logOut}
        >
          {t("wxmini.logout")}
        </Button>
      </VStack>
    </Center>
  )
}

export default BindWechat
