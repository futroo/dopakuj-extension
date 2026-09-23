<script setup lang="ts">
import { ArrowUpDown } from '@lucide/vue';
import type { SearchSort } from '../types/offers';
defineProps<{ modelValue: SearchSort }>();
const emit = defineEmits<{ 'update:modelValue': [value: SearchSort] }>();
</script>

<template>
  <label class="sort-selector"><ArrowUpDown :size="15" aria-hidden="true" /><span class="sr-only">Sortowanie</span>
    <select :value="modelValue" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value as SearchSort)">
      <option value="relevance">Domyślna</option><option value="price-asc">Cena rosnąco</option><option value="price-desc">Cena malejąco</option>
      <option value="title-asc">Nazwa A–Z</option><option value="title-desc">Nazwa Z–A</option><option value="seller-asc">Sprzedawca A–Z</option><option value="seller-desc">Sprzedawca Z–A</option>
    </select>
  </label>
</template>
