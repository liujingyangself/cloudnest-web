import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  VStack,
} from "@hope-ui/solid"
import { MaybeLoading, FolderChooseInput } from "~/components"
import { useFetch, useRouter, useT } from "~/hooks"
import {
  deadlineInDays,
  fromDatetimeLocal,
  handleResp,
  handleRespWithoutNotify,
  notify,
  r,
  toDatetimeLocal,
} from "~/utils"
import {
  PEmptyResp,
  PPageResp,
  PResp,
  Role,
  User,
  UserMethods,
  UserPermissions,
  UserRole,
} from "~/types"
import { createStore } from "solid-js/store"
import { createSignal, For, Show } from "solid-js"

// Quick grants, so the common cases need no date arithmetic.
const EXPIRE_PRESETS = [30, 90, 365] as const

const Permission = (props: {
  can: boolean
  onChange: (val: boolean) => void
  name: string
}) => {
  const t = useT()
  return (
    <FormControl
      display="inline-flex"
      flexDirection="row"
      alignItems="center"
      gap="$2"
      rounded="$md"
      shadow="$md"
      p="$2"
      w="fit-content"
    >
      <FormLabel mb="0">{t(`users.permissions.${props.name}`)}</FormLabel>
      <Checkbox
        checked={props.can}
        onChange={() => props.onChange(!props.can)}
      />
    </FormControl>
  )
}

const RoleToggle = (props: {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}) => (
  <FormControl
    display="inline-flex"
    flexDirection="row"
    alignItems="center"
    gap="$2"
    rounded="$md"
    shadow="$md"
    p="$2"
    w="fit-content"
  >
    <FormLabel mb="0">{props.label}</FormLabel>
    <Checkbox
      checked={props.checked}
      onChange={() => props.onChange(!props.checked)}
    />
  </FormControl>
)

const AddOrEdit = () => {
  const t = useT()
  const { params, back } = useRouter()
  const { id } = params
  const [user, setUser] = createStore<User>({
    id: 0,
    username: "",
    password: "",
    base_path: "",
    // Placeholder until the role list loads and selects a real id. If that
    // request fails the server maps this legacy GENERAL constant onto the
    // actual "general" role, so creating a user still works.
    role: [UserRole.GENERAL],
    permission: 0,
    disabled: false,
    sso_id: "",
    expires_at: null,
  })
  const [userLoading, loadUser] = useFetch(
    (): PResp<User> => r.get(`/admin/user/get?id=${id}`),
  )

  // The account deadline is edited separately from the rest of the form: the
  // server treats an absent expires_at on /update as "unchanged" so that an
  // older web build cannot silently wipe a paid membership, which means
  // clearing it has to go through /set_expire explicitly.
  const [loadedExpire, setLoadedExpire] = createSignal<string | null>(null)
  const initEdit = async () => {
    const resp = await loadUser()
    handleResp(resp, (data) => {
      setUser(data)
      setLoadedExpire(data.expires_at ?? null)
    })
  }
  if (id) {
    initEdit()
  }

  const [roles, setRoles] = createSignal<Role[]>([])
  const [, getRoles] = useFetch(
    (): PPageResp<Role> => r.get("/admin/role/list"),
  )
  const initRoles = async () => {
    const resp = await getRoles()
    // Not being able to list roles must not raise an error toast of its own —
    // the rest of the form stays usable.
    handleRespWithoutNotify(resp, (data) => {
      setRoles(data.content)
      if (id) return
      const preset =
        data.content.find((role) => role.default) ??
        data.content.find((role) => role.name === "general")
      if (preset) setUser("role", [preset.id])
    })
  }
  initRoles()

  // The server refuses to assign guest or admin, so neither is offered here.
  const assignableRoles = () =>
    roles().filter(
      (role) => role.id !== UserRole.GUEST && role.id !== UserRole.ADMIN,
    )
  const selectedRoles = () =>
    Array.isArray(user.role) ? user.role : [user.role]
  const toggleRole = (roleId: number, checked: boolean) => {
    const rest = selectedRoles().filter((selected) => selected !== roleId)
    setUser("role", checked ? [...rest, roleId].sort((a, b) => a - b) : rest)
  }
  const [okLoading, ok] = useFetch((): PEmptyResp => {
    return r.post(`/admin/user/${id ? "update" : "create"}`, user)
  })
  const [, saveExpire] = useFetch(
    (): PEmptyResp =>
      r.post("/admin/user/set_expire", {
        id: Number(id),
        ...(user.expires_at
          ? { expires_at: user.expires_at }
          : { never: true }),
      }),
  )
  return (
    <MaybeLoading loading={userLoading()}>
      <VStack w="$full" alignItems="start" spacing="$2">
        <Heading>{t(`global.${id ? "edit" : "add"}`)}</Heading>
        <Show when={!UserMethods.is_guest(user)}>
          <FormControl w="$full" display="flex" flexDirection="column" required>
            <FormLabel for="username" display="flex" alignItems="center">
              {t(`users.username`)}
            </FormLabel>
            <Input
              id="username"
              value={user.username}
              onInput={(e) => setUser("username", e.currentTarget.value)}
            />
          </FormControl>
          <FormControl w="$full" display="flex" flexDirection="column" required>
            <FormLabel for="password" display="flex" alignItems="center">
              {t(`users.password`)}
            </FormLabel>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={user.password}
              onInput={(e) => setUser("password", e.currentTarget.value)}
            />
          </FormControl>
        </Show>

        <FormControl w="$full" display="flex" flexDirection="column" required>
          <FormLabel for="base_path" display="flex" alignItems="center">
            {t(`users.base_path`)}
          </FormLabel>
          <FolderChooseInput
            id="base_path"
            value={user.base_path}
            onChange={(path) => setUser("base_path", path)}
            onlyFolder
          />
        </FormControl>
        <Show when={!UserMethods.is_guest(user) && !UserMethods.is_admin(user)}>
          <FormControl w="$full" required>
            <FormLabel display="flex" alignItems="center">
              {t(`users.role`)}
            </FormLabel>
            <Flex w="$full" wrap="wrap" gap="$2">
              <For each={assignableRoles()}>
                {(role) => (
                  <RoleToggle
                    label={role.name}
                    checked={selectedRoles().includes(role.id)}
                    onChange={(val) => toggleRole(role.id, val)}
                  />
                )}
              </For>
            </Flex>
          </FormControl>
        </Show>
        <FormControl w="$full" required>
          <FormLabel display="flex" alignItems="center">
            {t(`users.permission`)}
          </FormLabel>
          <Flex w="$full" wrap="wrap" gap="$2">
            <For each={UserPermissions}>
              {(item, i) => (
                <Permission
                  name={item}
                  can={UserMethods.can(user, i())}
                  onChange={(val) => {
                    if (val) {
                      setUser("permission", (user.permission |= 1 << i()))
                    } else {
                      setUser("permission", (user.permission &= ~(1 << i())))
                    }
                  }}
                />
              )}
            </For>
          </Flex>
        </FormControl>
        <FormControl w="$full" display="flex" flexDirection="column">
          <FormLabel for="expires_at" display="flex" alignItems="center">
            {t(`users.expires_at`)}
          </FormLabel>
          <Flex w="$full" wrap="wrap" gap="$2" alignItems="center">
            <Input
              id="expires_at"
              type="datetime-local"
              w="fit-content"
              value={toDatetimeLocal(user.expires_at)}
              onInput={(e) =>
                setUser("expires_at", fromDatetimeLocal(e.currentTarget.value))
              }
            />
            <For each={EXPIRE_PRESETS}>
              {(days) => (
                <Button
                  size="sm"
                  colorScheme="neutral"
                  onClick={() =>
                    setUser("expires_at", deadlineInDays(days, user.expires_at))
                  }
                >
                  {t("users.expire_add_days", { days: String(days) })}
                </Button>
              )}
            </For>
            <Button
              size="sm"
              colorScheme="neutral"
              disabled={!user.expires_at}
              onClick={() => setUser("expires_at", null)}
            >
              {t("users.expire_never")}
            </Button>
          </Flex>
          <Box color="$neutral10" fontSize="$sm" mt="$1">
            {user.expires_at
              ? t("users.expire_tips")
              : t("users.expire_never_tips")}
          </Box>
        </FormControl>
        <FormControl w="fit-content" display="flex">
          <Checkbox
            css={{ whiteSpace: "nowrap" }}
            id="disabled"
            onChange={(e: any) => setUser("disabled", e.currentTarget.checked)}
            color="$neutral10"
            fontSize="$sm"
            checked={user.disabled}
          >
            {t(`users.disabled`)}
          </Checkbox>
        </FormControl>
        <Button
          loading={okLoading()}
          onClick={async () => {
            const resp = await ok()
            // TODO maybe can use handleRespWithNotifySuccess
            handleResp(resp, async () => {
              // On create the deadline rides along with the new user; on edit
              // it needs its own call, and only when it actually changed.
              if (id && (user.expires_at ?? null) !== loadedExpire()) {
                const expireResp = await saveExpire()
                let failed = false
                handleResp(expireResp, undefined, () => {
                  failed = true
                })
                if (failed) return
              }
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

export default AddOrEdit
