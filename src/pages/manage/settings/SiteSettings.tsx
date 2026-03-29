import { VStack } from "@hope-ui/solid"
import { lazy } from "solid-js"
import { Group } from "~/types"

const CommonSettings = lazy(() => import("./Common"))
const BaiduOAuth = lazy(() => import("./BaiduOAuth"))

const SiteSettings = () => (
  <VStack w="$full" alignItems="start" spacing="$4">
    <CommonSettings group={Group.SITE} />
    <BaiduOAuth />
  </VStack>
)

export default SiteSettings
