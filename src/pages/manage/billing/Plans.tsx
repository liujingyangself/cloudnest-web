import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
} from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
import {
  useFetch,
  useListFetch,
  useManageTitle,
  useRouter,
  useT,
} from "~/hooks"
import { handleResp, notify, r } from "~/utils"
import { PEmptyResp, PPageResp, Plan, UNLIMITED } from "~/types"
import { DeletePopover } from "../common/DeletePopover"

/** Quota columns store -1 for "unlimited", which reads badly as a raw number. */
const quota = (gb: number, unlimited: string) =>
  gb === UNLIMITED ? unlimited : `${gb} GB`

const speed = (bytesPerSec: number, unlimited: string) =>
  bytesPerSec === 0
    ? unlimited
    : `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`

const Plans = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.plans")
  const { to } = useRouter()
  const [plans, setPlans] = createSignal<Plan[]>([])
  const [loading, getPlans] = useFetch(
    (): PPageResp<Plan> => r.get("/admin/plan/list"),
  )
  const refresh = async () => {
    handleResp(await getPlans(), (data) => setPlans(data.content ?? []))
  }
  refresh()

  const [deleting, deletePlan] = useListFetch(
    (id: number): PEmptyResp => r.post(`/admin/plan/delete?id=${id}`),
  )
  // Enabling/disabling is the switch admins flip most, so it gets a one-click
  // toggle instead of a trip through the edit form.
  const [toggling, togglePlan] = useListFetch(
    (_id: number, plan?: Plan): PEmptyResp =>
      r.post("/admin/plan/update", { ...plan!, enabled: !plan!.enabled }),
  )

  return (
    <VStack spacing="$2" alignItems="start" w="$full">
      <HStack spacing="$2">
        <Button colorScheme="accent" loading={loading()} onClick={refresh}>
          {t("global.refresh")}
        </Button>
        <Button onClick={() => to("/@manage/billing/plans/add")}>
          {t("global.add")}
        </Button>
      </HStack>
      <Show
        when={plans().length}
        fallback={
          <Box color="$neutral10" p="$4">
            {t("billing.no_plans")}
          </Box>
        }
      >
        <Box w="$full" overflowX="auto">
          <Table highlightOnHover dense>
            <Thead>
              <Tr>
                <For
                  each={[
                    "name",
                    "price",
                    "duration",
                    "bandwidth",
                    "speed_limit",
                    "enabled",
                  ]}
                >
                  {(title) => <Th>{t(`billing.${title}`)}</Th>}
                </For>
                <Th>{t("global.operations")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              <For each={plans()}>
                {(plan) => (
                  <Tr>
                    <Td>
                      <VStack alignItems="start" spacing="$0_5">
                        <Box>{plan.name}</Box>
                        <Show when={plan.description}>
                          <Box color="$neutral10" fontSize="$xs">
                            {plan.description}
                          </Box>
                        </Show>
                      </VStack>
                    </Td>
                    <Td>¥{plan.price}</Td>
                    <Td>{t("billing.n_days", { n: String(plan.duration) })}</Td>
                    <Td>
                      {quota(plan.monthly_bandwidth_gb, t("billing.unlimited"))}
                    </Td>
                    <Td>
                      {speed(
                        plan.speed_limit_bytes_per_sec,
                        t("billing.unlimited"),
                      )}
                    </Td>
                    <Td>
                      <Badge colorScheme={plan.enabled ? "success" : "neutral"}>
                        {t(`billing.${plan.enabled ? "on_sale" : "off_sale"}`)}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing="$2">
                        <Button
                          onClick={() =>
                            to(`/@manage/billing/plans/edit/${plan.id}`)
                          }
                        >
                          {t("global.edit")}
                        </Button>
                        <Button
                          colorScheme="accent"
                          loading={toggling() === plan.id}
                          onClick={async () => {
                            handleResp(await togglePlan(plan.id, plan), () => {
                              notify.success(t("global.save_success"))
                              refresh()
                            })
                          }}
                        >
                          {t(`billing.${plan.enabled ? "disable" : "enable"}`)}
                        </Button>
                        <DeletePopover
                          name={plan.name}
                          loading={deleting() === plan.id}
                          onClick={async () => {
                            handleResp(await deletePlan(plan.id), () => {
                              notify.success(t("global.delete_success"))
                              refresh()
                            })
                          }}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                )}
              </For>
            </Tbody>
          </Table>
        </Box>
      </Show>
    </VStack>
  )
}

export default Plans
