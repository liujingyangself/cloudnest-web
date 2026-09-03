import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
} from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
import { useFetch, useT } from "~/hooks"
import { me, Me, setMe } from "~/store"
import { PEmptyResp, Plan, PResp, UserSubscription } from "~/types"
import {
  daysUntilExpire,
  formatDate,
  handleResp,
  handleRespWithoutNotify,
  isExpired,
  notify,
  r,
} from "~/utils"

/** Below this, renewal stops being a someday task and becomes a reminder. */
const REMIND_DAYS = 14

/**
 * The member's own view of their account: how long they have left, what they
 * are on, and a way to top up.
 *
 * Redeeming used to live only on the expired page, so a member who wanted to
 * renew *before* running out had nowhere to go — the only path was to let the
 * account lapse first.
 */
export const MembershipCard = () => {
  const t = useT()
  const [code, setCode] = createSignal("")
  const [sub, setSub] = createSignal<UserSubscription | null>(null)
  const [plans, setPlans] = createSignal<Plan[]>([])

  const [, getSub] = useFetch(
    (): PResp<UserSubscription | null> => r.get("/billing/subscription"),
  )
  const [, getPlans] = useFetch((): PResp<Plan[]> => r.get("/public/plans"))
  const [, reloadMe] = useFetch((): PResp<Me> => r.get("/me"))
  const [redeeming, redeem] = useFetch(
    (): PEmptyResp => r.post("/billing/redeem", { code: code().trim() }),
  )

  // Neither is worth an error toast: the card is still useful with just the
  // deadline from /me.
  ;(async () => {
    handleRespWithoutNotify(await getSub(), (d) => setSub(d ?? null))
    handleRespWithoutNotify(await getPlans(), (d) => setPlans(d ?? []))
  })()

  const expiresAt = () => me().expires_at
  const expired = () => isExpired(expiresAt())
  const daysLeft = () => daysUntilExpire(expiresAt())

  const statusColor = () => {
    if (!expiresAt()) return "info"
    if (expired()) return "danger"
    return daysLeft() <= REMIND_DAYS ? "warning" : "success"
  }

  const statusText = () => {
    if (!expiresAt()) return t("membership.never_expires")
    if (expired()) return t("membership.expired")
    return t("membership.days_left", { n: String(daysLeft()) })
  }

  const submit = async () => {
    if (!code().trim()) return
    handleResp(await redeem(), async () => {
      handleResp(await reloadMe(), (data) => {
        setMe(data)
        setCode("")
        notify.success(t("membership.redeem_success"))
      })
      handleRespWithoutNotify(await getSub(), (d) => setSub(d ?? null))
    })
  }

  return (
    <VStack
      w="$full"
      alignItems="start"
      spacing="$3"
      p="$4"
      rounded="$lg"
      shadow="$md"
    >
      <HStack spacing="$2" alignItems="center">
        <Heading size="lg">{t("membership.title")}</Heading>
        <Badge colorScheme={statusColor() as any} textTransform="none">
          {statusText()}
        </Badge>
      </HStack>

      <VStack alignItems="start" spacing="$1">
        <Show
          when={sub()}
          fallback={<Text color="$neutral10">{t("membership.no_plan")}</Text>}
        >
          <Text>
            {t("membership.current_plan")}: <b>{sub()!.plan?.name}</b>
          </Text>
        </Show>
        <Show
          when={expiresAt()}
          fallback={
            <Text color="$neutral10">{t("membership.never_expires_tips")}</Text>
          }
        >
          <Text color="$neutral11">
            {t("membership.expires_at")}: {formatDate(expiresAt()!)}
          </Text>
        </Show>
      </VStack>

      <Show when={!expired() && expiresAt() && daysLeft() <= REMIND_DAYS}>
        <Box
          w="$full"
          p="$2"
          rounded="$md"
          bg="$warning3"
          color="$warning11"
          fontSize="$sm"
        >
          {t("membership.renew_reminder", { n: String(daysLeft()) })}
        </Box>
      </Show>

      <VStack w="$full" alignItems="stretch" spacing="$2">
        <Text fontWeight="$medium">{t("membership.redeem_label")}</Text>
        <HStack spacing="$2">
          <Input
            placeholder={t("membership.redeem_placeholder")}
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
            {t("membership.redeem")}
          </Button>
        </HStack>
        <Text color="$neutral10" fontSize="$sm">
          {t("membership.redeem_tips")}
        </Text>
      </VStack>

      <Show when={plans().length}>
        <VStack w="$full" alignItems="stretch" spacing="$2">
          <Text fontWeight="$medium">{t("membership.plans_label")}</Text>
          <For each={plans()}>
            {(plan) => (
              <HStack
                justifyContent="space-between"
                alignItems="baseline"
                p="$2"
                rounded="$md"
                borderWidth="1px"
                borderColor="$neutral6"
              >
                <VStack alignItems="start" spacing="$0_5">
                  <Text>{plan.name}</Text>
                  <Show when={plan.description}>
                    <Text color="$neutral10" fontSize="$sm">
                      {plan.description}
                    </Text>
                  </Show>
                </VStack>
                <VStack alignItems="end" spacing="$0_5">
                  <Text fontWeight="$semibold">¥{plan.price}</Text>
                  <Text color="$neutral10" fontSize="$sm">
                    {t("membership.n_days", { n: String(plan.duration) })}
                  </Text>
                </VStack>
              </HStack>
            )}
          </For>
        </VStack>
      </Show>
    </VStack>
  )
}
