<script setup lang="ts">import { PackageSearch } from '@lucide/vue'; defineProps<{ title: string; message: string }>();</script>
<template><div class="empty-state"><PackageSearch :size="30" /><strong>{{ title }}</strong><p>{{ message }}</p></div></template>
