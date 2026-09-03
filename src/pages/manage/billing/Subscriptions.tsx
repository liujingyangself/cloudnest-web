import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SelectContent,
  SelectIcon,
  SelectListbox,
  SelectOption,
  SelectOptionText,
  SelectPlaceholder,
  SelectTrigger,
  SelectValue,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
} from "@hope-ui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Paginator } from "~/components"
import { useFetch, useManageTitle, useT } from "~/hooks"
import { formatDate, handleResp, notify, r } from "~/utils"
import {
  PEmptyResp,
  Plan,
  PPageResp,
  SUB_STATUS_COLOR,
  User,
  UserSubscription,
} from "~/types"

const PER_PAGE = 30

const Subscriptions = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.subscriptions")

  const [subs, setSubs] = createSignal<UserSubscription[]>([])
  const [total, setTotal] = createSignal(0)
  const [plans, setPlans] = createSignal<Plan[]>([])
  const [users, setUsers] = createSignal<User[]>([])

  const [loading, getSubs] = useFetch(
    (page: number): PPageResp<UserSubscription> =>
      r.get(`/admin/subscription/list?page=${page}&per_page=${PER_PAGE}`),
  )
  const [, getPlans] = useFetch(
    (): PPageResp<Plan> => r.get("/admin/plan/list"),
  )
  const [, getUsers] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
  )

  // Rows carry ids; names are what an admin recognises.
  const userNames = createMemo(() =>
    Object.fromEntries(users().map((u) => [u.id, u.username])),
  )

  const refresh = async (page = 1) => {
    handleResp(await getSubs(page), (data) => {
      setSubs(data.content ?? [])
      setTotal(data.total)
    })
  }
  ;(async () => {
    const [planResp, userResp] = await Promise.all([getPlans(), getUsers()])
    handleResp(planResp, (d) => setPlans(d.content ?? []))
    handleResp(userResp, (d) => setUsers(d.content ?? []))
    await refresh()
  })()

  // --- manual grant ---------------------------------------------------------
  const [grantUser, setGrantUser] = createSignal<number>()
  const [grantPlan, setGrantPlan] = createSignal<number>()
  const [grantDays, setGrantDays] = createSignal(30)
  const [remark, setRemark] = createSignal("")

  const onPickPlan = (id: number) => {
    setGrantPlan(id)
    const plan = plans().find((p) => p.id === id)
    if (plan?.duration) setGrantDays(plan.duration)
  }

  const [granting, grant] = useFetch(
    (): PEmptyResp =>
      r.post("/admin/subscription/grant", {
        user_id: grantUser(),
        plan_id: grantPlan(),
        duration_days: grantDays(),
        remark: remark(),
      }),
  )

  const submitGrant = async () => {
    if (!grantUser() || !grantPlan()) {
      notify.warning(t("billing.grant_pick_both"))
      return
    }
    handleResp(await grant(), () => {
      notify.success(t("global.save_success"))
      setRemark("")
      refresh()
    })
  }

  // Admin and guest never carry a subscription; offering them is just noise.
  const grantableUsers = createMemo(() =>
    users().filter((u) => u.username !== "admin" && u.username !== "guest"),
  )

  return (
    <VStack spacing="$4" alignItems="start" w="$full">
      <VStack
        w="$full"
        alignItems="start"
        spacing="$2"
        p="$4"
        rounded="$lg"
        shadow="$md"
      >
        <Heading size="lg">{t("billing.grant")}</Heading>
        <Box color="$neutral10" fontSize="$sm">
          {t("billing.grant-tips")}
        </Box>
        <Show
          when={plans().length}
          fallback={
            <Box color="$warning10">{t("billing.no_plans_for_codes")}</Box>
          }
        >
          <SimpleGrid w="$full" columns={{ "@initial": 1, "@md": 4 }} gap="$3">
            <FormControl display="flex" flexDirection="column" required>
              <FormLabel>{t("billing.user")}</FormLabel>
              <Select value={grantUser()} onChange={setGrantUser}>
                <SelectTrigger>
                  <SelectPlaceholder>
                    {t("billing.pick_user")}
                  </SelectPlaceholder>
                  <SelectValue />
                  <SelectIcon />
                </SelectTrigger>
                <SelectContent>
                  <SelectListbox>
                    <For each={grantableUsers()}>
                      {(u) => (
                        <SelectOption value={u.id}>
                          <SelectOptionText>{u.username}</SelectOptionText>
                        </SelectOption>
                      )}
                    </For>
                  </SelectListbox>
                </SelectContent>
              </Select>
            </FormControl>
            <FormControl display="flex" flexDirection="column" required>
              <FormLabel>{t("billing.plan")}</FormLabel>
              <Select value={grantPlan()} onChange={onPickPlan}>
                <SelectTrigger>
                  <SelectPlaceholder>
                    {t("billing.pick_plan")}
                  </SelectPlaceholder>
                  <SelectValue />
                  <SelectIcon />
                </SelectTrigger>
                <SelectContent>
                  <SelectListbox>
                    <For each={plans()}>
                      {(p) => (
                        <SelectOption value={p.id}>
                          <SelectOptionText>{p.name}</SelectOptionText>
                        </SelectOption>
                      )}
                    </For>
                  </SelectListbox>
                </SelectContent>
              </Select>
            </FormControl>
            <FormControl display="flex" flexDirection="column">
              <FormLabel for="grant-days">{t("billing.duration")}</FormLabel>
              <Input
                id="grant-days"
                type="number"
                min={1}
                value={String(grantDays())}
                onInput={(e) =>
                  setGrantDays(Number(e.currentTarget.value || 0))
                }
              />
            </FormControl>
            <FormControl display="flex" flexDirection="column">
              <FormLabel for="grant-remark">{t("billing.remark")}</FormLabel>
              <Input
                id="grant-remark"
                value={remark()}
                placeholder={t("billing.remark-tips")}
                onInput={(e) => setRemark(e.currentTarget.value)}
              />
            </FormControl>
          </SimpleGrid>
          <Button loading={granting()} onClick={submitGrant}>
            {t("billing.grant")}
          </Button>
        </Show>
      </VStack>

      <HStack spacing="$2">
        <Button
          colorScheme="accent"
          loading={loading()}
          onClick={() => refresh()}
        >
          {t("global.refresh")}
        </Button>
        <Box color="$neutral10">
          {t("billing.total_subs", { n: String(total()) })}
        </Box>
      </HStack>

      <Show
        when={subs().length}
        fallback={<Box color="$neutral10">{t("billing.no_subs")}</Box>}
      >
        <Box w="$full" overflowX="auto">
          <Table highlightOnHover dense>
            <Thead>
              <Tr>
                <For
                  each={["user", "plan", "start_time", "end_time", "status"]}
                >
                  {(title) => <Th>{t(`billing.${title}`)}</Th>}
                </For>
              </Tr>
            </Thead>
            <Tbody>
              <For each={subs()}>
                {(sub) => (
                  <Tr>
                    <Td>{userNames()[sub.user_id] ?? `#${sub.user_id}`}</Td>
                    <Td>{sub.plan?.name || `#${sub.plan_id}`}</Td>
                    <Td css={{ whiteSpace: "nowrap" }}>
                      {formatDate(sub.start_time)}
                    </Td>
                    <Td css={{ whiteSpace: "nowrap" }}>
                      {formatDate(sub.end_time)}
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={
                          (SUB_STATUS_COLOR[sub.status] ?? "neutral") as any
                        }
                        textTransform="none"
                      >
                        {t(`billing.sub_status.${sub.status}`)}
                      </Badge>
                    </Td>
                  </Tr>
                )}
              </For>
            </Tbody>
          </Table>
        </Box>
        <Paginator
          total={total()}
          defaultPageSize={PER_PAGE}
          onChange={(page) => refresh(page)}
        />
      </Show>
    </VStack>
  )
}

export default Subscriptions
