<script setup lang="ts">import { AlertCircle, RotateCcw } from '@lucide/vue'; defineProps<{ message: string; retry?: boolean }>(); const emit = defineEmits<{ retry: [] }>();</script>
<template><div class="error-state"><AlertCircle :size="22" /><p>{{ message }}</p><button v-if="retry" class="text-button" type="button" @click="emit('retry')"><RotateCcw :size="14" /> Ponów</button></div></template>
