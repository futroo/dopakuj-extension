import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import Panel from '../entrypoints/sidepanel/App.vue';
import { installChromeMock } from './preview/mock';
import { searchStore } from '../stores/search.store';

let app: App;
let root: HTMLDivElement;
const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); await nextTick(); };
const mount = async () => { app = createApp(Panel); app.mount(root); await flush(); };
const button = (text: string) => [...root.querySelectorAll('button')].find((element) => element.textContent?.trim() === text)!;
const search = async () => {
  const input = root.querySelector<HTMLInputElement>('#offer-query')!;
  input.value = 'kawa';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
};
beforeEach(() => {
  Object.assign(searchStore, { query: '', offers: [], sellers: {}, phase: 'idle', message: '', startedAt: 0 });
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => { app?.unmount(); root.remove(); vi.useRealTimers(); });

it('pokazuje liczbę ofert i sprzedawców, a wyczyszczenie usuwa wyniki i przywraca fokus', async () => {
  const mock = installChromeMock();
  await mount();
  await search();
  expect(root.querySelector('#results-heading')?.textContent).toContain('30 ofert od 3 sprzedawców');
  button('Wyczyść').click();
  await flush();
  expect(root.querySelectorAll('.offer-card')).toHaveLength(0);
  expect(root.querySelector<HTMLInputElement>('#offer-query')?.value).toBe('');
  expect(document.activeElement?.id).toBe('offer-query');
  expect(searchStore.phase).toBe('idle');
  expect(mock.session.pendingSearch).toBeUndefined();
});

it('wyczyszczenie podczas oczekiwania na koszyk nie uruchamia odroczonego wyszukiwania', async () => {
  vi.useFakeTimers();
  const mock = installChromeMock({ waitingCart: true });
  await mount();
  await search();
  expect(mock.session.pendingSearch).toBeDefined();
  button('Wyczyść').click();
  await flush();
  mock.state.status = 'ready';
  await vi.advanceTimersByTimeAsync(1000);
  expect(mock.calls.some((message) => message.type === 'FETCH_SELLER_PAGE')).toBe(false);
  expect(searchStore.phase).toBe('idle');
  expect(mock.session.pendingSearch).toBeUndefined();
});

it('Zatrzymaj przerywa również oczekiwanie na koszyk', async () => {
  vi.useFakeTimers();
  const mock = installChromeMock({ waitingCart: true });
  await mount();
  await search();
  button('Zatrzymaj').click();
  await flush();
  mock.state.status = 'ready';
  await vi.advanceTimersByTimeAsync(1000);
  expect(searchStore.phase).toBe('cancelled');
  expect(mock.calls.some((message) => message.type === 'FETCH_SELLER_PAGE')).toBe(false);
});
