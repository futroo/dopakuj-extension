<script setup lang="ts">
import { Search, ExternalLink, ImageOff } from '@lucide/vue';
import { ref, watch } from 'vue';
import type { OfferSearchResult } from '../types/offers';
import { sendMessage } from '../services/message-bus';
const props = defineProps<{ offer: OfferSearchResult }>();
const imageFailed = ref(false);
watch(() => props.offer.imageUrl, () => { imageFailed.value = false; });
const open = (url: string) => void sendMessage({ type: 'OPEN_URL', payload: { url } });
</script>

<template>
  <article class="offer-card">
    <a class="offer-image" :href="offer.offerUrl" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true" @click.prevent="open(offer.offerUrl)">
      <img v-if="offer.imageUrl && !imageFailed" :src="offer.imageUrl" alt="" loading="lazy" referrerpolicy="no-referrer" @error="imageFailed = true" />
      <ImageOff v-else :size="24" />
    </a>
    <div class="offer-body">
      <h3><a :href="offer.offerUrl" target="_blank" rel="noopener noreferrer" :title="offer.title" @click.prevent="open(offer.offerUrl)">{{ offer.title }}</a></h3>
      <div class="price"><strong>{{ offer.price.formatted }}</strong><del v-if="offer.originalPrice">{{ offer.originalPrice.formatted }}</del></div>
      <div v-if="offer.isSmart || offer.freeDelivery || offer.condition || offer.isSponsored" class="badges">
        <span v-if="offer.isSmart" class="badge smart">Smart!</span><span v-if="offer.freeDelivery" class="badge">Darmowa dostawa</span><span v-if="offer.condition" class="badge">{{ offer.condition }}</span><span v-if="offer.isSponsored" class="badge">Sponsorowana</span>
      </div>
      <div class="seller-links">
        <a :href="offer.sellerShopUrl" target="_blank" rel="noopener noreferrer" :title="'Otwórz sklep: ' + offer.sellerLogin" @click.prevent="open(offer.sellerShopUrl)"><span>{{ offer.sellerLogin }}</span><ExternalLink :size="12" /></a>
        <a class="search-seller" :href="offer.sellerSearchUrl" target="_blank" rel="noopener noreferrer" :aria-label="'Szukaj tej frazy u sprzedawcy ' + offer.sellerLogin" title="Zobacz wyniki w sklepie" @click.prevent="open(offer.sellerSearchUrl)"><Search :size="15" /></a>
      </div>
    </div>
  </article>
</template>

