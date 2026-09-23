<script setup lang="ts">
import type { SellerMode } from '../types/cart';
defineProps<{ modelValue: SellerMode; selectedCount: number; allCount: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: SellerMode] }>();
</script>

<template>
  <fieldset class="mode-selector">
    <legend>Uwzględnij sprzedawców</legend>
    <label :class="{ active: modelValue === 'selected' }">
      <input type="radio" name="seller-mode" value="selected" :checked="modelValue === 'selected'" @change="emit('update:modelValue', 'selected')" />
      <span>Tylko zaznaczeni</span><b>{{ selectedCount }}</b>
    </label>
    <label :class="{ active: modelValue === 'all' }">
      <input type="radio" name="seller-mode" value="all" :checked="modelValue === 'all'" @change="emit('update:modelValue', 'all')" />
      <span>Wszyscy z koszyka</span><b>{{ allCount }}</b>
    </label>
  </fieldset>
</template>
