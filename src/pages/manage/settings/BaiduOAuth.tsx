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
import { PResp } from "~/types"
import { handleResp, notify, r } from "~/utils"

interface BaiduStorageStatus {
  id: number
  mount_path: string
  status: string
}

interface BaiduAuthURLResp {
  auth_url: string
  mode: string // "callback" | "oob"
}

const BaiduOAuth = () => {
  const t = useT()
  const [storages, setStorages] = createSignal<BaiduStorageStatus[]>([])
  const [code, setCode] = createSignal("")
  const [showCodeInput, setShowCodeInput] = createSignal(false)
  const [activeStorageId, setActiveStorageId] = createSignal(0)

  // Fetch status
  const [statusLoading, fetchStatus] = useFetch(
    (): PResp<BaiduStorageStatus[]> => r.get("/admin/baidu_oauth/status"),
  )
  const refreshStatus = async () => {
    const resp = await fetchStatus()
    handleResp(resp, (data) => setStorages(data || []))
  }
  refreshStatus()

  // Get auth URL
  const [urlLoading, getAuthURL] = useFetch(
    (storageId: number): PResp<BaiduAuthURLResp> =>
      r.post("/admin/baidu_oauth/get_url", { storage_id: storageId }),
  )

  // Exchange code
  const [exchangeLoading, exchangeCode] = useFetch(
    (storageId: number, authCode: string): PResp<string> =>
      r.post("/admin/baidu_oauth/exchange_code", {
        storage_id: storageId,
        code: authCode,
      }),
  )

  const handleAuth = async (storageId: number) => {
    const resp = await getAuthURL(storageId)
    handleResp(resp, (data: BaiduAuthURLResp) => {
      if (data.mode === "callback") {
        // Callback mode: open popup, listen for postMessage
        const popup = window.open(
          data.auth_url,
          "baidu_oauth",
          "width=600,height=700",
        )
        const handler = (event: MessageEvent) => {
          if (event.data?.baidu_oauth === "success") {
            window.removeEventListener("message", handler)
            notify.success("百度网盘授权成功")
            refreshStatus()
          }
        }
        window.addEventListener("message", handler)
        // Clean up if popup is closed without completing
        const timer = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(timer)
            window.removeEventListener("message", handler)
            refreshStatus()
          }
        }, 1000)
      } else {
        // OOB mode: open Baidu page, show code input
        window.open(data.auth_url, "_blank")
        setActiveStorageId(storageId)
        setCode("")
        setShowCodeInput(true)
      }
    })
  }

  const handleExchangeCode = async () => {
    const resp = await exchangeCode(activeStorageId(), code())
    handleResp(resp, () => {
      notify.success("百度网盘授权成功")
      setShowCodeInput(false)
      setCode("")
      refreshStatus()
    })
  }

  return (
    <Box w="$full" mt="$4">
      <Heading size="lg" mb="$3">
        百度网盘授权
      </Heading>
      <Show
        when={storages().length > 0}
        fallback={
          <Text color="$neutral9" fontSize="$sm">
            未找到百度网盘存储
          </Text>
        }
      >
        <VStack spacing="$3" alignItems="stretch">
          <For each={storages()}>
            {(storage) => (
              <HStack
                p="$3"
                borderWidth="1px"
                borderColor="$neutral6"
                borderRadius="$md"
                justifyContent="space-between"
                alignItems="center"
              >
                <HStack spacing="$3" alignItems="center">
                  <Text fontWeight="$medium">{storage.mount_path}</Text>
                  <Badge
                    colorScheme={storage.status === "work" ? "success" : "danger"}
                  >
                    {storage.status === "work" ? "正常" : "异常"}
                  </Badge>
                  <Show when={storage.status !== "work"}>
                    <Text
                      fontSize="$xs"
                      color="$danger9"
                      css={{ "max-width": "300px", "word-break": "break-all" }}
                    >
                      {storage.status}
                    </Text>
                  </Show>
                </HStack>
                <Button
                  size="sm"
                  colorScheme={storage.status === "work" ? "neutral" : "danger"}
                  loading={urlLoading()}
                  onClick={() => handleAuth(storage.id)}
                >
                  {storage.status === "work" ? "重新授权" : "立即授权"}
                </Button>
              </HStack>
            )}
          </For>
        </VStack>
      </Show>

      {/* OOB code input dialog */}
      <Show when={showCodeInput()}>
        <Box
          mt="$3"
          p="$4"
          borderWidth="1px"
          borderColor="$accent6"
          borderRadius="$md"
          bg="$accent2"
        >
          <Text mb="$2" fontWeight="$medium">
            请在百度页面完成授权后，将页面上显示的授权码粘贴到下方：
          </Text>
          <HStack spacing="$2">
            <Input
              placeholder="粘贴授权码"
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value)}
              flex={1}
            />
            <Button
              loading={exchangeLoading()}
              onClick={handleExchangeCode}
              disabled={!code()}
            >
              确认授权
            </Button>
            <Button
              colorScheme="neutral"
              onClick={() => {
                setShowCodeInput(false)
                setCode("")
              }}
            >
              取消
            </Button>
          </HStack>
        </Box>
      </Show>

      <HStack mt="$3">
        <Button
          size="sm"
          colorScheme="accent"
          loading={statusLoading()}
          onClick={refreshStatus}
        >
          {t("global.refresh")}
        </Button>
      </HStack>
    </Box>
  )
}

export default BaiduOAuth
