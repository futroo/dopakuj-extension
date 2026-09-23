<script setup lang="ts">
import { SlidersHorizontal, RotateCcw, ChevronDown } from '@lucide/vue';
import type { CartSeller } from '../types/cart';
import type { SearchFilters } from '../types/offers';
const props = defineProps<{ filters: SearchFilters; sellers: CartSeller[]; conditions: string[]; activeCount: number }>();
const emit = defineEmits<{ reset: []; change: [] }>();
const toggleSeller = (id: string, checked: boolean) => {
  const enabled = props.filters.sellerIds !== null ? [...props.filters.sellerIds] : props.sellers.map((seller) => seller.id);
  const next = checked ? [...new Set([...enabled, id])] : enabled.filter((value) => value !== id);
  props.filters.sellerIds = next.length === props.sellers.length ? null : next;
  emit('change');
};
const sellerEnabled = (id: string) => props.filters.sellerIds === null || props.filters.sellerIds.includes(id);
const setPrice = (key: 'minPrice' | 'maxPrice', event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  props.filters[key] = value === '' ? undefined : Number(value);
  emit('change');
};
</script>

<template>
  <details class="filters-panel">
    <summary><span><SlidersHorizontal :size="16" /> Filtry <b v-if="activeCount">{{ activeCount }}</b></span><ChevronDown :size="16" /></summary>
    <div class="filters-content">
      <fieldset v-if="sellers.length" class="check-grid">
        <legend>Sprzedawcy w wynikach</legend>
        <label v-for="seller in sellers" :key="seller.id"><input type="checkbox" :checked="sellerEnabled(seller.id)" @change="toggleSeller(seller.id, ($event.target as HTMLInputElement).checked)" />{{ seller.login }}</label>
      </fieldset>
      <div class="price-grid">
        <label>Cena od <input :value="filters.minPrice ?? ''" type="number" min="0" step="0.01" placeholder="0" @input="setPrice('minPrice', $event)" /></label>
        <label>Cena do <input :value="filters.maxPrice ?? ''" type="number" min="0" step="0.01" placeholder="bez limitu" @input="setPrice('maxPrice', $event)" /></label>
      </div>
      <p v-if="filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice" class="inline-warning" role="status">Cena „od” nie może być wyższa niż cena „do”.</p>
      <div class="toggle-grid">
        <label><input v-model="filters.smartOnly" type="checkbox" @change="emit('change')" /> Tylko Smart!</label>
        <label><input v-model="filters.freeDeliveryOnly" type="checkbox" @change="emit('change')" /> Darmowa dostawa</label>
        <label><input v-model="filters.showSponsored" type="checkbox" @change="emit('change')" /> Pokaż sponsorowane</label>
      </div>
      <fieldset v-if="conditions.length" class="check-grid">
        <legend>Stan</legend>
        <label v-for="condition in conditions" :key="condition"><input v-model="filters.conditions" type="checkbox" :value="condition" @change="emit('change')" />{{ condition }}</label>
      </fieldset>
      <label>Wyników na stronę
        <select v-model.number="filters.perPage" @change="emit('change')"><option :value="12">12</option><option :value="24">24</option><option :value="48">48</option></select>
      </label>
      <button class="text-button" type="button" @click="emit('reset')"><RotateCcw :size="14" /> Wyczyść filtry</button>
    </div>
  </details>
</template>
