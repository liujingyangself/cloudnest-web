import {
  Box,
  Button,
  Center,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
} from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
import { useFetch, useRouter, useT, useTitle } from "~/hooks"
import { me, Me, setMe } from "~/store"
import { PEmptyResp, Plan, PResp } from "~/types"
import {
  changeToken,
  formatDate,
  handleResp,
  handleRespWithoutNotify,
  notify,
  r,
} from "~/utils"

/**
 * Shown in place of the file browser once an account's validity period has
 * lapsed. The server refuses everything except this page's own calls, so the
 * only ways forward are redeeming a code or signing out.
 */
const Expired = () => {
  const t = useT()
  useTitle(() => t("expire.title"))
  const { to } = useRouter()
  const [code, setCode] = createSignal("")

  // Showing what is on offer turns "your account expired" into something the
  // user can act on, instead of a dead end they have to ask about.
  const [plans, setPlans] = createSignal<Plan[]>([])
  const [, getPlans] = useFetch((): PResp<Plan[]> => r.get("/public/plans"))
  ;(async () => {
    // A missing or empty plan list is not an error worth a toast here — the
    // page still works as a redeem-code entry point.
    handleRespWithoutNotify(await getPlans(), (data) => setPlans(data ?? []))
  })()

  const [redeeming, redeem] = useFetch(
    (): PEmptyResp => r.post("/billing/redeem", { code: code().trim() }),
  )
  const [, reloadMe] = useFetch((): PResp<Me> => r.get("/me"))
  const [loggingOut, logOutReq] = useFetch(
    (): PResp<any> => r.get("/auth/logout"),
  )

  const submit = async () => {
    if (!code().trim()) return
    handleResp(await redeem(), async () => {
      // The deadline moved, so pull the fresh account state: MustUser drops
      // this page as soon as the user is valid again.
      handleResp(await reloadMe(), (data) => {
        setMe(data)
        notify.success(t("expire.redeem_success"))
      })
    })
  }

  const logOut = async () => {
    handleResp(await logOutReq(), () => {
      changeToken()
      to("/@login")
    })
  }

  return (
    <Center h="100vh" p="$4">
      <VStack spacing="$4" maxW="$md" w="$full" alignItems="stretch">
        <VStack spacing="$1" alignItems="start">
          <Heading size="xl">{t("expire.title")}</Heading>
          <Text color="$neutral11">{t("expire.description")}</Text>
        </VStack>

        <Box p="$3" rounded="$md" bg="$neutral3" color="$neutral11">
          {t("expire.account")}: <b>{me().username}</b>
        </Box>

        <Show when={me().expires_at}>
          <Box p="$3" rounded="$md" bg="$neutral3" color="$neutral11">
            {t("expire.expired_at")}: {formatDate(me().expires_at!)}
          </Box>
        </Show>

        <Show when={plans().length}>
          <VStack spacing="$2" alignItems="stretch">
            <Text fontWeight="$medium">{t("expire.plans_label")}</Text>
            <For each={plans()}>
              {(plan) => (
                <HStack
                  justifyContent="space-between"
                  alignItems="baseline"
                  p="$3"
                  rounded="$md"
                  borderWidth="1px"
                  borderColor="$neutral6"
                >
                  <VStack alignItems="start" spacing="$0_5">
                    <Text fontWeight="$medium">{plan.name}</Text>
                    <Show when={plan.description}>
                      <Text color="$neutral10" fontSize="$sm">
                        {plan.description}
                      </Text>
                    </Show>
                  </VStack>
                  <VStack alignItems="end" spacing="$0_5">
                    <Text fontWeight="$semibold">¥{plan.price}</Text>
                    <Text color="$neutral10" fontSize="$sm">
                      {t("expire.n_days", { n: String(plan.duration) })}
                    </Text>
                  </VStack>
                </HStack>
              )}
            </For>
          </VStack>
        </Show>

        <VStack spacing="$2" alignItems="stretch">
          <Text fontWeight="$medium">{t("expire.redeem_label")}</Text>
          <HStack spacing="$2">
            <Input
              placeholder={t("expire.redeem_placeholder")}
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") submit()
              }}
            />
            <Button
              loading={redeeming()}
              disabled={!code().trim()}
              onClick={submit}
            >
              {t("expire.redeem")}
            </Button>
          </HStack>
          <Text color="$neutral10" fontSize="$sm">
            {t("expire.contact_admin")}
          </Text>
        </VStack>

        <Button
          colorScheme="neutral"
          variant="outline"
          loading={loggingOut()}
          onClick={logOut}
        >
          {t("expire.logout")}
        </Button>
      </VStack>
    </Center>
  )
}

export default Expired
