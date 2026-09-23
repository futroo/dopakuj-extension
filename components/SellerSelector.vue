<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from '@lucide/vue';
import type { CartSeller } from '../types/cart';
const props = defineProps<{ sellers: CartSeller[]; excluded: string[] }>();
const emit = defineEmits<{ 'update:excluded': [value: string[]] }>();
const enabled = computed(() => props.sellers.length - props.excluded.filter((id) => props.sellers.some((seller) => seller.id === id)).length);
const toggle = (id: string, checked: boolean) => emit('update:excluded', checked ? props.excluded.filter((value) => value !== id) : [...props.excluded, id]);
</script>

<template>
  <details class="seller-selector">
    <summary>Wybierz sprzedawców <span>{{ enabled }}/{{ sellers.length }}</span><ChevronDown :size="16" /></summary>
    <div class="seller-checks">
      <label v-for="seller in sellers" :key="seller.id">
        <input type="checkbox" :checked="!excluded.includes(seller.id)" @change="toggle(seller.id, ($event.target as HTMLInputElement).checked)" />
        <span>{{ seller.login }}</span><small>{{ seller.selectedItemsCount }}/{{ seller.allItemsCount }} zazn.</small>
      </label>
    </div>
  </details>
</template>
