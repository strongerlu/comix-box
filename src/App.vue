<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue'
import MemoryWorkbench from './components/memory/MemoryWorkbench.vue'
import GlobalSearch from './components/search/GlobalSearch.vue'
import LocalCapabilitySetup from './components/settings/LocalCapabilitySetup.vue'
import { shouldShowSetupWizard } from './utils/localCapabilities'
import { isTauriRuntime } from './utils/tauriEnv'
import { startDesktopProjectDropDispatcher } from './services/desktopProjectDrop'
import { bindDesktopRemoteRuntime } from './services/desktopRemoteBridge'
import { createDesktopConversationHost, startDesktopConversationPublisher } from './services/desktopConversationRuntime'

const showSetupWizard = ref(false)
const desktopRuntime = isTauriRuntime()
let stopDesktopProjectDrop: () => void = () => undefined
let stopDesktopConversationPublisher: () => void = () => undefined
let appUnmounted = false

onMounted(async () => {
  if (!desktopRuntime) return
  stopDesktopConversationPublisher = startDesktopConversationPublisher()
  void bindDesktopRemoteRuntime(createDesktopConversationHost()).catch(error => console.warn('[desktop-remote] Gateway listener failed:', error))
  try {
    const stop = await startDesktopProjectDropDispatcher()
    if (appUnmounted) stop()
    else stopDesktopProjectDrop = stop
  } catch (error) {
    console.warn('[desktop-drop] failed to start:', error)
  }
  try {
    showSetupWizard.value = await shouldShowSetupWizard()
  } catch { /* ignore */ }
})

onBeforeUnmount(() => {
  appUnmounted = true
  stopDesktopProjectDrop()
  stopDesktopConversationPublisher()
})

</script>

<template>
  <MemoryWorkbench />
  <GlobalSearch v-if="desktopRuntime" />
  <LocalCapabilitySetup
    v-if="showSetupWizard"
    mode="modal"
    @close="showSetupWizard = false"
  />
</template>
