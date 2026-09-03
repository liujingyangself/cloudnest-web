import {
  Badge,
  Box,
  Button,
  HStack,
  Select,
  SelectContent,
  SelectIcon,
  SelectListbox,
  SelectOption,
  SelectOptionText,
  SelectTrigger,
  SelectValue,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
} from "@hope-ui/solid"
import { createMemo, createSignal, For, Show } from "solid-js"
import {
  useFetch,
  useListFetch,
  useManageTitle,
  useRouter,
  useT,
} from "~/hooks"
import {
  daysUntilExpire,
  formatDate,
  handleResp,
  handleRespWithoutNotify,
  isExpired,
  notify,
  r,
} from "~/utils"
import {
  UserPermissions,
  User,
  UserMethods,
  PPageResp,
  PEmptyResp,
  Role,
} from "~/types"
import { DeletePopover } from "../common/DeletePopover"
import { Wether } from "~/components"

const ROLE_COLORS: Record<string, string> = {
  general: "info",
  guest: "neutral",
  admin: "accent",
}

// Role ids are rows in the roles table, so they cannot be resolved to a name
// without the role list. `names` is empty until that request lands, and stays
// empty if it fails, hence the `#id` fallback.
const RoleBadges = (props: {
  role: number | number[]
  names: Record<number, string>
}) => {
  const ids = () => (Array.isArray(props.role) ? props.role : [props.role])
  return (
    <HStack spacing="$1">
      <For each={ids()}>
        {(id) => {
          const name = () => props.names[id] ?? `#${id}`
          return (
            <Badge colorScheme={(ROLE_COLORS[name()] ?? "info") as any}>
              {name()}
            </Badge>
          )
        }}
      </For>
    </HStack>
  )
}

const Permissions = (props: { user: User }) => {
  const t = useT()
  const color = (can: boolean) => `$${can ? "success" : "danger"}9`
  return (
    <HStack spacing="$0_5">
      <For each={UserPermissions}>
        {(item, i) => (
          <Tooltip label={t(`users.permissions.${item}`)}>
            <Box
              boxSize="$2"
              rounded="$full"
              bg={color(UserMethods.can(props.user, i()))}
            ></Box>
          </Tooltip>
        )}
      </For>
    </HStack>
  )
}

// Deadlines are what admins scan this column for, so an expired or
// nearly-expired account has to stand out from a wall of dates.
const EXPIRE_SOON_DAYS = 7

const ExpireCell = (props: { user: User }) => {
  const t = useT()
  const expiresAt = () => props.user.expires_at
  const color = () => {
    if (!expiresAt()) return undefined
    if (isExpired(expiresAt())) return "$danger9"
    if (daysUntilExpire(expiresAt()) <= EXPIRE_SOON_DAYS) return "$warning9"
    return undefined
  }
  return (
    <Show
      when={expiresAt()}
      fallback={<Box color="$neutral9">{t("users.expire_never")}</Box>}
    >
      <Box color={color()} css={{ whiteSpace: "nowrap" }}>
        {formatDate(expiresAt()!)}
        <Show when={isExpired(expiresAt())}>
          {" "}
          <Badge colorScheme="danger">{t("users.expired")}</Badge>
        </Show>
      </Box>
    </Show>
  )
}

// 按到期状态筛选。用户规模是几十量级，前端筛足够快，不值得为此给
// /admin/user/list 加查询参数。
type ExpireFilter = "all" | "expired" | "soon" | "never"

const matchesFilter = (user: User, filter: ExpireFilter): boolean => {
  switch (filter) {
    case "expired":
      return isExpired(user.expires_at)
    case "soon":
      return (
        !isExpired(user.expires_at) &&
        !!user.expires_at &&
        daysUntilExpire(user.expires_at) <= EXPIRE_SOON_DAYS
      )
    case "never":
      return !user.expires_at
    default:
      return true
  }
}

const Users = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.users")
  const { to } = useRouter()
  const [filter, setFilter] = createSignal<ExpireFilter>("all")
  const [getUsersLoading, getUsers] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
  )
  const [users, setUsers] = createSignal<User[]>([])
  const [, getRoles] = useFetch(
    (): PPageResp<Role> => r.get("/admin/role/list"),
  )
  const [roleNames, setRoleNames] = createSignal<Record<number, string>>({})
  const refresh = async () => {
    const [usersResp, rolesResp] = await Promise.all([getUsers(), getRoles()])
    handleResp(usersResp, (data) => setUsers(data.content))
    // The user list stays usable without role names, so failing to load them
    // must not raise an error toast of its own.
    handleRespWithoutNotify(rolesResp, (data) =>
      setRoleNames(
        Object.fromEntries(data.content.map((role) => [role.id, role.name])),
      ),
    )
  }
  refresh()

  const shownUsers = createMemo(() => {
    const list = users().filter((u) => matchesFilter(u, filter()))
    // 快到期的排前面，永不过期的沉底：这正是"谁该催费"的顺序。
    return list.sort((a, b) => {
      if (!a.expires_at && !b.expires_at) return a.id - b.id
      if (!a.expires_at) return 1
      if (!b.expires_at) return -1
      return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
    })
  })

  const counts = createMemo(() => ({
    all: users().length,
    expired: users().filter((u) => matchesFilter(u, "expired")).length,
    soon: users().filter((u) => matchesFilter(u, "soon")).length,
    never: users().filter((u) => matchesFilter(u, "never")).length,
  }))

  const [deleting, deleteUser] = useListFetch(
    (id: number): PEmptyResp => r.post(`/admin/user/delete?id=${id}`),
  )
  const [cancel_2faId, cancel_2fa] = useListFetch(
    (id: number): PEmptyResp => r.post(`/admin/user/cancel_2fa?id=${id}`),
  )
  return (
    <VStack spacing="$2" alignItems="start" w="$full">
      <HStack spacing="$2">
        <Button
          colorScheme="accent"
          loading={getUsersLoading()}
          onClick={refresh}
        >
          {t("global.refresh")}
        </Button>
        <Button
          onClick={() => {
            to("/@manage/users/add")
          }}
        >
          {t("global.add")}
        </Button>
        <Select value={filter()} onChange={setFilter}>
          <SelectTrigger w="$56">
            <SelectValue />
            <SelectIcon />
          </SelectTrigger>
          <SelectContent>
            <SelectListbox>
              <For each={["all", "soon", "expired", "never"] as ExpireFilter[]}>
                {(f) => (
                  <SelectOption value={f}>
                    <SelectOptionText>
                      {t(`users.filter_${f}`)}
                    </SelectOptionText>
                  </SelectOption>
                )}
              </For>
            </SelectListbox>
          </SelectContent>
        </Select>
      </HStack>
      <HStack spacing="$3" color="$neutral11" fontSize="$sm" wrap="wrap">
        <Box>
          {t("users.filter_expired")}: {counts().expired}
        </Box>
        <Box>
          {t("users.filter_soon")}: {counts().soon}
        </Box>
        <Box>
          {t("users.filter_never")}: {counts().never}
        </Box>
        <Box>
          {t("users.filter_all")}: {counts().all}
        </Box>
      </HStack>
      <Box w="$full" overflowX="auto">
        <Table highlightOnHover dense>
          <Thead>
            <Tr>
              <For
                each={[
                  "username",
                  "base_path",
                  "role",
                  "permission",
                  "expires_at",
                  "available",
                ]}
              >
                {(title) => <Th>{t(`users.${title}`)}</Th>}
              </For>
              <Th>{t("global.operations")}</Th>
            </Tr>
          </Thead>
          <Tbody>
            <For each={shownUsers()}>
              {(user) => (
                <Tr>
                  <Td>{user.username}</Td>
                  <Td>{user.base_path}</Td>
                  <Td>
                    <RoleBadges role={user.role} names={roleNames()} />
                  </Td>
                  <Td>
                    <Permissions user={user} />
                  </Td>
                  <Td>
                    <ExpireCell user={user} />
                  </Td>
                  <Td>
                    <Wether yes={!user.disabled} />
                  </Td>
                  <Td>
                    <HStack spacing="$2">
                      <Button
                        onClick={() => {
                          to(`/@manage/users/edit/${user.id}`)
                        }}
                      >
                        {t("global.edit")}
                      </Button>
                      <DeletePopover
                        name={user.username}
                        loading={deleting() === user.id}
                        onClick={async () => {
                          const resp = await deleteUser(user.id)
                          handleResp(resp, () => {
                            notify.success(t("global.delete_success"))
                            refresh()
                          })
                        }}
                      />
                      <Button
                        colorScheme="accent"
                        loading={cancel_2faId() === user.id}
                        onClick={async () => {
                          const resp = await cancel_2fa(user.id)
                          handleResp(resp, () => {
                            notify.success(t("users.cancel_2fa_success"))
                            refresh()
                          })
                        }}
                      >
                        {t("users.cancel_2fa")}
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              )}
            </For>
          </Tbody>
        </Table>
      </Box>
    </VStack>
  )
}

export default Users
