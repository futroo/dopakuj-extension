import { computed, ref, watch, type Ref } from 'vue';

export function paginate<T>(items: T[], page: number, perPage: number): T[] {
  return items.slice((page - 1) * perPage, page * perPage);
}

export function usePagination<T>(items: Ref<T[]>, perPage: Ref<number>) {
  const page = ref(1);
  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / perPage.value)));
  const pageItems = computed(() => paginate(items.value, page.value, perPage.value));
  watch([items, perPage], () => { if (page.value > totalPages.value) page.value = totalPages.value; });
  return { page, totalPages, pageItems, resetPage: () => { page.value = 1; } };
}
