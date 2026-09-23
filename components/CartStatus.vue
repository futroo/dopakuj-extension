<script setup lang="ts">
import { ShoppingCart, RefreshCw, ExternalLink, AlertTriangle, LoaderCircle } from '@lucide/vue';
import type { CartState } from '../types/cart';
import type { ActiveContext } from '../types/messages';
import { plural } from '../utils/plural';
defineProps<{ state: CartState; context: ActiveContext; busy?: boolean }>();
const emit = defineEmits<{ refresh: []; openCart: [] }>();
</script>

<template>
  <section class="cart-status" :class="{ 'status-error': state.status === 'error' }" aria-live="polite">
    <LoaderCircle v-if="state.status === 'loading'" :size="16" class="spin" />
    <AlertTriangle v-else-if="state.status === 'error'" :size="16" />
    <ShoppingCart v-else :size="16" />
    <div class="status-copy">
      <span v-if="state.status === 'ready'">Koszyk <span class="separator">·</span> <strong>{{ state.sellers.length }} {{ plural(state.sellers.length, 'sprzedawca', 'sprzedawcy', 'sprzedawców') }}</strong></span>
      <span v-else-if="state.status === 'loading'">Odczytuję koszyk…</span>
      <span v-else-if="state.status === 'empty'">Koszyk jest pusty. Dodaj pierwszy produkt.</span>
      <span v-else-if="state.status === 'error'">{{ state.error || 'Nie udało się odczytać koszyka.' }}</span>
      <span v-else>Najpierw odczytamy sprzedawców z koszyka.</span>
    </div>
    <button v-if="context.isCart || state.sourceTabId !== undefined" class="icon-button ghost" type="button" :disabled="busy || state.status === 'loading'" title="Odśwież koszyk" aria-label="Odśwież dane koszyka" @click="emit('refresh')"><RefreshCw :size="15" /></button>
    <button v-else class="text-button" type="button" :disabled="busy" @click="emit('openCart')">Otwórz <ExternalLink :size="13" /></button>
  </section>
</template>

