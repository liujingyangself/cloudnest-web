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
import { createMemo, createSignal, For, Show } from "solid-js"
import { Paginator } from "~/components"
import { useFetch, useManageTitle, useT } from "~/hooks"
import { formatDate, handleResp, r } from "~/utils"
import { Plan, PPageResp, Transaction, TX_STATUS_COLOR, User } from "~/types"

const PER_PAGE = 30

/**
 * Read-only ledger of every subscription grant, redeem and payment. There is
 * no create/edit here on purpose: rows are written by the flows that actually
 * move value, and an editable ledger is not a ledger.
 */
const Transactions = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.transactions")

  const [txns, setTxns] = createSignal<Transaction[]>([])
  const [total, setTotal] = createSignal(0)
  const [plans, setPlans] = createSignal<Plan[]>([])
  const [users, setUsers] = createSignal<User[]>([])

  const [loading, getTxns] = useFetch(
    (page: number): PPageResp<Transaction> =>
      r.get(`/admin/transaction/list?page=${page}&per_page=${PER_PAGE}`),
  )
  const [, getPlans] = useFetch(
    (): PPageResp<Plan> => r.get("/admin/plan/list"),
  )
  const [, getUsers] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
  )

  const userNames = createMemo(() =>
    Object.fromEntries(users().map((u) => [u.id, u.username])),
  )
  const planNames = createMemo(() =>
    Object.fromEntries(plans().map((p) => [p.id, p.name])),
  )

  const refresh = async (page = 1) => {
    handleResp(await getTxns(page), (data) => {
      setTxns(data.content ?? [])
      setTotal(data.total)
    })
  }
  ;(async () => {
    const [planResp, userResp] = await Promise.all([getPlans(), getUsers()])
    handleResp(planResp, (d) => setPlans(d.content ?? []))
    handleResp(userResp, (d) => setUsers(d.content ?? []))
    await refresh()
  })()

  return (
    <VStack spacing="$2" alignItems="start" w="$full">
      <HStack spacing="$2">
        <Button
          colorScheme="accent"
          loading={loading()}
          onClick={() => refresh()}
        >
          {t("global.refresh")}
        </Button>
        <Box color="$neutral10">
          {t("billing.total_txns", { n: String(total()) })}
        </Box>
      </HStack>

      <Show
        when={txns().length}
        fallback={<Box color="$neutral10">{t("billing.no_txns")}</Box>}
      >
        <Box w="$full" overflowX="auto">
          <Table highlightOnHover dense>
            <Thead>
              <Tr>
                <For
                  each={[
                    "created_at",
                    "user",
                    "plan",
                    "tx_type",
                    "amount",
                    "status",
                    "remark",
                  ]}
                >
                  {(title) => <Th>{t(`billing.${title}`)}</Th>}
                </For>
              </Tr>
            </Thead>
            <Tbody>
              <For each={txns()}>
                {(tx) => (
                  <Tr>
                    <Td css={{ whiteSpace: "nowrap" }}>
                      {formatDate(tx.created_at)}
                    </Td>
                    <Td>{userNames()[tx.user_id] ?? `#${tx.user_id}`}</Td>
                    <Td>{planNames()[tx.plan_id] ?? `#${tx.plan_id}`}</Td>
                    <Td>{t(`billing.tx_types.${tx.type}`)}</Td>
                    <Td>{tx.amount > 0 ? `¥${tx.amount}` : "-"}</Td>
                    <Td>
                      <Badge
                        colorScheme={
                          (TX_STATUS_COLOR[tx.status] ?? "neutral") as any
                        }
                        textTransform="none"
                      >
                        {t(`billing.tx_status.${tx.status}`)}
                      </Badge>
                    </Td>
                    <Td>{tx.remark || "-"}</Td>
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

export default Transactions
