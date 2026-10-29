<script setup>
// Tombol kembali di atas judul halaman admin. Tujuannya satu tingkat di atas
// halaman ini, sama dengan tombol Batal di form.
defineProps({
  to: { type: [String, Object], required: true },
  label: { type: String, default: 'Kembali' },
})
</script>

<template>
  <RouterLink
    :to="to"
    class="inline-flex w-fit items-center gap-2 rounded-xl border border-wf-border bg-wf-card px-4 py-2 text-[18px] leading-7 font-semibold text-wf-text transition hover:border-wf-brand-border hover:bg-wf-brand-soft"
  >
    {{ label }}
  </RouterLink>
</template>
