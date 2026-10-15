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
    <!-- Ikon arrow-left dari Lucide, warnanya mengikuti teks -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-5 shrink-0"
      aria-hidden="true"
    >
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
    {{ label }}
  </RouterLink>
</template>
