<script setup lang="ts">
import { ChevronLeft, ChevronRight, Plus, LoaderCircle } from '@lucide/vue';
defineProps<{ page: number; totalPages: number; count: number; perPage: number; hasRemoteMore: boolean; loadingMore: boolean }>();
const emit = defineEmits<{ previous: []; next: []; loadMore: [] }>();
</script>

<template>
  <nav class="pagination" aria-label="Strony pobranych ofert">
    <div v-if="count" class="page-navigation">
      <button class="icon-button" type="button" :disabled="page <= 1" aria-label="Poprzednia strona" @click="emit('previous')"><ChevronLeft :size="18" /></button>
      <span>{{ (page - 1) * perPage + 1 }}–{{ Math.min(page * perPage, count) }} z {{ count }} <span class="page-number">· strona {{ page }}/{{ totalPages }}</span></span>
      <button class="icon-button" type="button" :disabled="page >= totalPages" aria-label="Następna strona" @click="emit('next')"><ChevronRight :size="18" /></button>
    </div>
    <button v-if="hasRemoteMore" class="button button-secondary load-more" type="button" :disabled="loadingMore" @click="emit('loadMore')">
      <LoaderCircle v-if="loadingMore" :size="16" class="spin" /><Plus v-else :size="16" />{{ loadingMore ? 'Pobieram kolejne oferty…' : 'Pobierz więcej ofert' }}
    </button>
  </nav>
</template>

