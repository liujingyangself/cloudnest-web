import {
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
import { handleResp, handleRespWithoutNotify, notify, r } from "~/utils"
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
  })
  const [userLoading, loadUser] = useFetch(
    (): PResp<User> => r.get(`/admin/user/get?id=${id}`),
  )

  const initEdit = async () => {
    const resp = await loadUser()
    handleResp(resp, setUser)
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
            handleResp(resp, () => {
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
