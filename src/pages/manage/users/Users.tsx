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
  Tooltip,
  Tr,
  VStack,
} from "@hope-ui/solid"
import { createSignal, For } from "solid-js"
import {
  useFetch,
  useListFetch,
  useManageTitle,
  useRouter,
  useT,
} from "~/hooks"
import { handleResp, handleRespWithoutNotify, notify, r } from "~/utils"
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

const Users = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.users")
  const { to } = useRouter()
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
                  "available",
                ]}
              >
                {(title) => <Th>{t(`users.${title}`)}</Th>}
              </For>
              <Th>{t("global.operations")}</Th>
            </Tr>
          </Thead>
          <Tbody>
            <For each={users()}>
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
