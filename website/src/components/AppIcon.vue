<script setup lang="ts">
defineProps<{ name: 'table' | 'search' | 'arrow' | 'download' | 'external' | 'chevron' | 'close' | 'clock' | 'info' | 'calculator' }>();
const paths = {
  table: 'M4 4h16v16H4z M4 10h16 M10 4v16 M4 15h16',
  search: 'M21 21l-5-5 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0',
  arrow: 'M7 17L17 7 M7 7h10v10',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  external: 'M14 3h7v7 M21 3l-9 9 M10 3H3v18h18v-7',
  chevron: 'M9 5l7 7-7 7',
  close: 'M6 6l12 12 M6 18L18 6',
  clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  calculator: 'M5 3h14v18H5z M8 6h8v3H8z M8 13h1 M15 13h1 M8 17h1 M15 17h1',
};
</script>

<template><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg></template>
