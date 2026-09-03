import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Heading,
  Input,
  SimpleGrid,
  Textarea,
  VStack,
} from "@hope-ui/solid"
import { createStore } from "solid-js/store"
import { MaybeLoading } from "~/components"
import { useFetch, useRouter, useT } from "~/hooks"
import { emptyPlan, PEmptyResp, Plan, PResp, UNLIMITED } from "~/types"
import { handleResp, notify, r } from "~/utils"

const MB = 1024 * 1024

/** A number field that also offers "unlimited", which the API stores as -1. */
const QuotaField = (props: {
  id: string
  label: string
  value: number
  onChange: (val: number) => void
  unlimitedLabel: string
  suffix: string
}) => {
  const isUnlimited = () => props.value === UNLIMITED
  return (
    <FormControl w="$full" display="flex" flexDirection="column">
      <FormLabel for={props.id}>{props.label}</FormLabel>
      <Input
        id={props.id}
        type="number"
        min={0}
        disabled={isUnlimited()}
        value={isUnlimited() ? "" : String(props.value)}
        placeholder={isUnlimited() ? props.unlimitedLabel : props.suffix}
        onInput={(e) => props.onChange(Number(e.currentTarget.value || 0))}
      />
      <Checkbox
        mt="$1"
        fontSize="$sm"
        color="$neutral10"
        checked={isUnlimited()}
        onChange={() => props.onChange(isUnlimited() ? 0 : UNLIMITED)}
      >
        {props.unlimitedLabel}
      </Checkbox>
    </FormControl>
  )
}

const NumberField = (props: {
  id: string
  label: string
  value: number
  onChange: (val: number) => void
  help?: string
  step?: string
}) => (
  <FormControl w="$full" display="flex" flexDirection="column">
    <FormLabel for={props.id}>{props.label}</FormLabel>
    <Input
      id={props.id}
      type="number"
      min={0}
      step={props.step}
      value={String(props.value)}
      onInput={(e) => props.onChange(Number(e.currentTarget.value || 0))}
    />
    {props.help && (
      <Box color="$neutral10" fontSize="$sm" mt="$1">
        {props.help}
      </Box>
    )}
  </FormControl>
)

const PlanAddOrEdit = () => {
  const t = useT()
  const { params, back } = useRouter()
  const { id } = params
  const [plan, setPlan] = createStore<Plan>(emptyPlan())

  const [loading, loadPlan] = useFetch(
    (): PResp<Plan> => r.get(`/admin/plan/get?id=${id}`),
  )
  if (id) {
    ;(async () => handleResp(await loadPlan(), setPlan))()
  }

  const [saving, save] = useFetch(
    (): PEmptyResp => r.post(`/admin/plan/${id ? "update" : "create"}`, plan),
  )

  // Speed is stored in bytes/sec but nobody thinks in bytes/sec.
  const speedMB = () =>
    plan.speed_limit_bytes_per_sec === 0
      ? 0
      : Number((plan.speed_limit_bytes_per_sec / MB).toFixed(2))

  return (
    <MaybeLoading loading={loading()}>
      <VStack w="$full" alignItems="start" spacing="$3">
        <Heading>{t(`global.${id ? "edit" : "add"}`)}</Heading>

        <FormControl w="$full" display="flex" flexDirection="column" required>
          <FormLabel for="name">{t("billing.name")}</FormLabel>
          <Input
            id="name"
            value={plan.name}
            placeholder={t("billing.name-tips")}
            onInput={(e) => setPlan("name", e.currentTarget.value)}
          />
        </FormControl>

        <FormControl w="$full" display="flex" flexDirection="column">
          <FormLabel for="description">{t("billing.description")}</FormLabel>
          <Textarea
            id="description"
            value={plan.description}
            onInput={(e) => setPlan("description", e.currentTarget.value)}
          />
        </FormControl>

        <SimpleGrid w="$full" columns={{ "@initial": 1, "@md": 3 }} gap="$3">
          <NumberField
            id="price"
            label={t("billing.price")}
            value={plan.price}
            step="0.01"
            onChange={(v) => setPlan("price", v)}
          />
          <NumberField
            id="annual_price"
            label={t("billing.annual_price")}
            value={plan.annual_price}
            step="0.01"
            onChange={(v) => setPlan("annual_price", v)}
          />
          <NumberField
            id="duration"
            label={t("billing.duration")}
            value={plan.duration}
            help={t("billing.duration-tips")}
            onChange={(v) => setPlan("duration", v)}
          />
        </SimpleGrid>

        <SimpleGrid w="$full" columns={{ "@initial": 1, "@md": 2 }} gap="$3">
          <QuotaField
            id="monthly_bandwidth_gb"
            label={t("billing.bandwidth")}
            value={plan.monthly_bandwidth_gb}
            unlimitedLabel={t("billing.unlimited")}
            suffix="GB"
            onChange={(v) => setPlan("monthly_bandwidth_gb", v)}
          />
          <QuotaField
            id="storage_quota_gb"
            label={t("billing.storage")}
            value={plan.storage_quota_gb}
            unlimitedLabel={t("billing.unlimited")}
            suffix="GB"
            onChange={(v) => setPlan("storage_quota_gb", v)}
          />
        </SimpleGrid>

        <SimpleGrid w="$full" columns={{ "@initial": 1, "@md": 3 }} gap="$3">
          <NumberField
            id="speed_limit"
            label={t("billing.speed_limit")}
            value={speedMB()}
            step="0.1"
            help={t("billing.speed_limit-tips")}
            onChange={(v) =>
              setPlan("speed_limit_bytes_per_sec", Math.round(v * MB))
            }
          />
          <NumberField
            id="max_devices"
            label={t("billing.max_devices")}
            value={plan.max_devices}
            help={t("billing.zero_means_no_limit")}
            onChange={(v) => setPlan("max_devices", v)}
          />
          <NumberField
            id="sort_order"
            label={t("billing.sort_order")}
            value={plan.sort_order}
            help={t("billing.sort_order-tips")}
            onChange={(v) => setPlan("sort_order", v)}
          />
        </SimpleGrid>

        <FormControl w="fit-content" display="flex">
          <Checkbox
            css={{ whiteSpace: "nowrap" }}
            checked={plan.can_download}
            onChange={() => setPlan("can_download", !plan.can_download)}
          >
            {t("billing.can_download")}
          </Checkbox>
        </FormControl>
        <FormControl w="fit-content" display="flex">
          <Checkbox
            css={{ whiteSpace: "nowrap" }}
            checked={plan.enabled}
            onChange={() => setPlan("enabled", !plan.enabled)}
          >
            {t("billing.enabled")}
          </Checkbox>
        </FormControl>

        <Button
          loading={saving()}
          onClick={async () => {
            if (!plan.name.trim()) {
              notify.warning(t("billing.name_required"))
              return
            }
            handleResp(await save(), () => {
              notify.success(t("global.save_success"))
              back()
            })
          }}
        >
          {t(`global.${id ? "save" : "add"}`)}
        </Button>
      </VStack>
    </MaybeLoading>
  )
}

export default PlanAddOrEdit
