<script setup lang="ts">
import { ref } from 'vue';
import { Search, X, Square } from '@lucide/vue';
defineProps<{ modelValue: string; loading: boolean; canClear: boolean; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: []; cancel: []; clear: [] }>();
const input = ref<HTMLInputElement>();
defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <form class="search-bar" role="search" @submit.prevent="emit('submit')">
    <div class="search-label-row">
      <label for="offer-query">Czego szukasz?</label>
      <button class="clear-button" type="button" :disabled="!canClear || disabled" @click="emit('clear')"><X :size="14" /> Wyczyść</button>
    </div>
    <div class="search-input-row">
      <div class="search-field">
        <Search :size="18" aria-hidden="true" />
        <input id="offer-query" ref="input" :value="modelValue" type="search" autocomplete="off" placeholder="np. kawa ziarnista" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
      </div>
      <button v-if="loading" type="button" class="button button-secondary" @click="emit('cancel')"><Square :size="13" /> Zatrzymaj</button>
      <button v-else type="submit" class="button button-primary" :disabled="!modelValue.trim() || disabled">Szukaj</button>
    </div>
  </form>
</template>

