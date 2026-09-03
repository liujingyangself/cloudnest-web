import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
} from "@hope-ui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import { Paginator } from "~/components"
import { useFetch, useListFetch, useManageTitle, useT, useUtil } from "~/hooks"
import { formatDate, handleResp, notify, r } from "~/utils"
import { PEmptyResp, Plan, PPageResp, PResp, RedeemCode, User } from "~/types"
import { DeletePopover } from "../common/DeletePopover"

const PER_PAGE = 30

const RedeemCodes = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.redeem_codes")
  const { copy } = useUtil()

  const [codes, setCodes] = createSignal<RedeemCode[]>([])
  const [total, setTotal] = createSignal(0)
  const [plans, setPlans] = createSignal<Plan[]>([])
  // Codes carry only the redeemer's id; the name is what an admin recognises.
  const [userNames, setUserNames] = createSignal<Record<number, string>>({})

  const [loading, getCodes] = useFetch(
    (page: number): PPageResp<RedeemCode> =>
      r.get(`/admin/redeem/list?page=${page}&per_page=${PER_PAGE}`),
  )
  const [, getPlans] = useFetch(
    (): PPageResp<Plan> => r.get("/admin/plan/list"),
  )
  const [, getUsers] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
  )

  const planNames = createMemo(() =>
    Object.fromEntries(plans().map((p) => [p.id, p.name])),
  )

  const refresh = async (page = 1) => {
    handleResp(await getCodes(page), (data) => {
      setCodes(data.content ?? [])
      setTotal(data.total)
    })
  }
  ;(async () => {
    const [planResp, userResp] = await Promise.all([getPlans(), getUsers()])
    handleResp(planResp, (data) => setPlans(data.content ?? []))
    handleResp(userResp, (data) =>
      setUserNames(
        Object.fromEntries((data.content ?? []).map((u) => [u.id, u.username])),
      ),
    )
    await refresh()
  })()

  // --- generation form -----------------------------------------------------
  const [planId, setPlanId] = createSignal<number>()
  const [duration, setDuration] = createSignal(30)
  const [count, setCount] = createSignal(10)
  const [batchLabel, setBatchLabel] = createSignal("")
  const [generated, setGenerated] = createSignal<RedeemCode[]>([])

  // Picking a plan pre-fills its default length — that is the usual intent,
  // and it can still be overridden.
  const onPickPlan = (id: number) => {
    setPlanId(id)
    const plan = plans().find((p) => p.id === id)
    if (plan?.duration) setDuration(plan.duration)
  }

  const [generating, generate] = useFetch(
    (): PResp<RedeemCode[]> =>
      r.post("/admin/redeem/generate", {
        plan_id: planId(),
        duration: duration(),
        count: count(),
        batch_label: batchLabel(),
      }),
  )

  const submitGenerate = async () => {
    if (!planId()) {
      notify.warning(t("billing.pick_plan_first"))
      return
    }
    if (count() < 1 || count() > 1000) {
      notify.warning(t("billing.count_range"))
      return
    }
    handleResp(await generate(), (data) => {
      setGenerated(data ?? [])
      refresh()
    })
  }

  const [deleting, deleteCode] = useListFetch(
    (id: number): PEmptyResp => r.post(`/admin/redeem/delete?id=${id}`),
  )

  const status = (code: RedeemCode) => {
    if (code.used_by) {
      const name = userNames()[code.used_by] ?? `#${code.used_by}`
      return { color: "neutral", text: t("billing.used_by", { name }) }
    }
    if (code.expires_at && new Date(code.expires_at) <= new Date()) {
      return { color: "danger", text: t("billing.code_expired") }
    }
    return { color: "success", text: t("billing.unused") }
  }

  return (
    <VStack spacing="$4" alignItems="start" w="$full">
      {/* --- generate ------------------------------------------------------ */}
      <VStack
        w="$full"
        alignItems="start"
        spacing="$2"
        p="$4"
        rounded="$lg"
        shadow="$md"
        position="relative"
        zIndex={1}
      >
        <Heading size="lg">{t("billing.generate")}</Heading>
        <Show
          when={plans().length}
          fallback={
            <Box color="$warning10">{t("billing.no_plans_for_codes")}</Box>
          }
        >
          <SimpleGrid
            w="$full"
            columns={{ "@initial": 1, "@md": 4 }}
            gap="$3"
            position="relative"
            zIndex={2}
          >
            <FormControl display="flex" flexDirection="column" required>
              <FormLabel>{t("billing.plan")}</FormLabel>
              <Select value={planId()} onChange={onPickPlan}>
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
                      {(plan) => (
                        <SelectOption value={plan.id}>
                          <SelectOptionText>{plan.name}</SelectOptionText>
                        </SelectOption>
                      )}
                    </For>
                  </SelectListbox>
                </SelectContent>
              </Select>
            </FormControl>
            <FormControl display="flex" flexDirection="column">
              <FormLabel for="duration">{t("billing.duration")}</FormLabel>
              <Input
                id="duration"
                type="number"
                min={1}
                value={String(duration())}
                onInput={(e) => setDuration(Number(e.currentTarget.value || 0))}
              />
            </FormControl>
            <FormControl display="flex" flexDirection="column">
              <FormLabel for="count">{t("billing.count")}</FormLabel>
              <Input
                id="count"
                type="number"
                min={1}
                max={1000}
                value={String(count())}
                onInput={(e) => setCount(Number(e.currentTarget.value || 0))}
              />
            </FormControl>
            <FormControl display="flex" flexDirection="column">
              <FormLabel for="batch">{t("billing.batch_label")}</FormLabel>
              <Input
                id="batch"
                value={batchLabel()}
                placeholder={t("billing.batch_label-tips")}
                onInput={(e) => setBatchLabel(e.currentTarget.value)}
              />
            </FormControl>
          </SimpleGrid>
          <Button loading={generating()} onClick={submitGenerate}>
            {t("billing.generate")}
          </Button>
        </Show>
      </VStack>

      {/* --- list ---------------------------------------------------------- */}
      <HStack spacing="$2">
        <Button
          colorScheme="accent"
          loading={loading()}
          onClick={() => refresh()}
        >
          {t("global.refresh")}
        </Button>
        <Box color="$neutral10">
          {t("billing.total_codes", { n: String(total()) })}
        </Box>
      </HStack>

      <Show
        when={codes().length}
        fallback={<Box color="$neutral10">{t("billing.no_codes")}</Box>}
      >
        <Box w="$full" overflowX="auto">
          <Table highlightOnHover dense>
            <Thead>
              <Tr>
                <For
                  each={[
                    "code",
                    "plan",
                    "duration",
                    "status",
                    "batch_label",
                    "created_at",
                  ]}
                >
                  {(title) => <Th>{t(`billing.${title}`)}</Th>}
                </For>
                <Th>{t("global.operations")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              <For each={codes()}>
                {(code) => (
                  <Tr>
                    <Td>
                      <Box
                        css={{ fontFamily: "monospace", cursor: "pointer" }}
                        onClick={() => copy(code.code)}
                        title={t("billing.click_to_copy")}
                      >
                        {code.code}
                      </Box>
                    </Td>
                    <Td>{planNames()[code.plan_id] ?? `#${code.plan_id}`}</Td>
                    <Td>{t("billing.n_days", { n: String(code.duration) })}</Td>
                    <Td>
                      <Badge
                        colorScheme={status(code).color as any}
                        textTransform="none"
                      >
                        {status(code).text}
                      </Badge>
                    </Td>
                    <Td>{code.batch_label || "-"}</Td>
                    <Td css={{ whiteSpace: "nowrap" }}>
                      {formatDate(code.created_at)}
                    </Td>
                    <Td>
                      <DeletePopover
                        name={code.code}
                        loading={deleting() === code.id}
                        onClick={async () => {
                          handleResp(await deleteCode(code.id), () => {
                            notify.success(t("global.delete_success"))
                            refresh()
                          })
                        }}
                      />
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

      {/* --- freshly generated codes --------------------------------------- */}
      <Modal
        opened={generated().length > 0}
        onClose={() => setGenerated([])}
        size="xl"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>
            {t("billing.generated_n", { n: String(generated().length) })}
          </ModalHeader>
          <ModalBody>
            <Box color="$neutral10" fontSize="$sm" mb="$2">
              {t("billing.generated-tips")}
            </Box>
            <Textarea
              readOnly
              rows={10}
              css={{ fontFamily: "monospace" }}
              value={generated()
                .map((c) => c.code)
                .join("\n")}
            />
          </ModalBody>
          <ModalFooter>
            <HStack spacing="$2">
              <Button
                onClick={() =>
                  copy(
                    generated()
                      .map((c) => c.code)
                      .join("\n"),
                  )
                }
              >
                {t("billing.copy_all")}
              </Button>
              <Button colorScheme="neutral" onClick={() => setGenerated([])}>
                {t("global.close")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default RedeemCodes
