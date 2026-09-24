<script setup lang="ts">
import type { OfferSearchResult } from '../types/offers';
import OfferCard from './OfferCard.vue';
defineProps<{ offers: OfferSearchResult[]; grouped: boolean }>();
</script>

<template>
  <div class="results-list">
    <template v-for="(offer, index) in offers" :key="offer.id">
      <h3 v-if="grouped && (index === 0 || offers[index - 1]?.sellerId !== offer.sellerId)" class="seller-group-heading">{{ offer.sellerLogin }} <span>na tej stronie</span></h3>
      <OfferCard :offer="offer" />
    </template>
  </div>
</template>

