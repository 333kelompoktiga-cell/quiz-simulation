<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { mulaiPantauIdle } from './services/auth'

const router = useRouter()
let hentikanPantauIdle = null

onMounted(() => {
  hentikanPantauIdle = mulaiPantauIdle(() => {
    router.push('/')
  })
})

onBeforeUnmount(() => {
  if (hentikanPantauIdle) hentikanPantauIdle()
})
</script>

<template>
  <router-view />
</template>
