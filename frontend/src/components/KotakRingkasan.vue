<script setup>
// Komponen StatBox di Figma: angka besar dengan label di bawahnya.
defineProps({
  angka: { type: [String, Number], required: true },
  label: { type: String, required: true },
})
</script>

<template>
  <div class="bg-wf-card border border-wf-border rounded-md px-6 py-5 flex flex-col gap-1">
    <p class="text-[32px] lg:text-[36px] leading-tight font-bold text-wf-text">{{ angka }}</p>
    <p class="text-[15px] leading-5 font-semibold tracking-[1px] uppercase text-wf-secondary">{{ label }}</p>
  </div>
</template>
