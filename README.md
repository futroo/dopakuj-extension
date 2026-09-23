# Dobierz z koszyka

Rozszerzenie do Chrome i Edge, które pomaga znaleźć dodatkowe produkty u sprzedawców, od których już coś kupujesz na Allegro.

Przykład: masz w koszyku kawę od trzech sprzedawców i chcesz dorzucić filtry do ekspresu. Zamiast otwierać każdy sklep osobno, wpisujesz „filtry”, a rozszerzenie zbiera pasujące oferty w jednym panelu.

Projekt jest nieoficjalny i nie jest powiązany z Allegro. Rozszerzenia nie ma w Chrome Web Store ani Microsoft Edge Add-ons — instaluje się je ręcznie.

## Instalacja — bez programowania

Nie potrzebujesz Node.js, Git ani żadnych narzędzi programistycznych.

1. Wejdź w **Releases** po prawej stronie tego repozytorium i otwórz najnowszą wersję.
2. W sekcji **Assets** pobierz plik o nazwie podobnej do:

   ```text
   dobierz-z-koszyka-v1.0.0.zip
   ```

   Nie wybieraj automatycznego pliku **Source code**.

3. Rozpakuj pobrany ZIP do stałego miejsca, na przykład do folderu `Dokumenty\Dobierz z koszyka`. Nie usuwaj tego folderu po instalacji.
4. Otwórz stronę rozszerzeń:
   - Chrome: wpisz w pasku adresu `chrome://extensions`;
   - Edge: wpisz w pasku adresu `edge://extensions`.

5. Włącz **Tryb dewelopera**.
6. Kliknij **Załaduj rozpakowane**.
7. Wskaż rozpakowany folder — ten, w którym znajduje się plik `manifest.json`.
8. Opcjonalnie przypnij rozszerzenie do paska przeglądarki.

Gotowe. Ostrzeżenie o rozszerzeniu uruchomionym w trybie deweloperskim jest w tym przypadku normalne.

> ZIP-a nie da się zainstalować bezpośrednio. Najpierw trzeba go rozpakować.

## Jak używać

1. Otwórz Allegro i przejdź do koszyka.
2. Kliknij ikonę **Dobierz z koszyka**. Z boku przeglądarki otworzy się panel.
3. Wpisz nazwę produktu, którego szukasz.
4. Wybierz sprzedawców zaznaczonych w koszyku, wszystkich albo tylko wybrane osoby.
5. Kliknij **Szukaj**.

Wyniki możesz filtrować, sortować i grupować według sprzedawcy. Kliknięcie oferty otwiera ją na Allegro.

Sprzedawcy są sprawdzani kolejno, więc przy większym koszyku wyszukiwanie może chwilę potrwać. Jeżeli Allegro pokaże CAPTCHA, rozszerzenie otworzy zwykłą kartę, w której trzeba ręcznie przejść weryfikację.

## Aktualizacja rozszerzenia

1. Pobierz ZIP z najnowszego Release.
2. Rozpakuj go.
3. Na stronie `chrome://extensions` albo `edge://extensions` usuń starą wersję.
4. Kliknij ponownie **Załaduj rozpakowane** i wskaż nowy folder.

Przy takiej aktualizacji lokalne ustawienia rozszerzenia mogą zostać wyzerowane.

## Prywatność

Rozszerzenie działa lokalnie w przeglądarce. Nie ma własnego serwera, analityki ani konta użytkownika.

- odczytuje z koszyka nazwy sprzedawców oraz informację, które produkty są zaznaczone;
- otwiera publiczne strony ofert sprzedawców;
- zapisuje tylko lokalne ustawienia i tymczasowy stan wyszukiwania;
- nie ma uprawnienia do bezpośredniego odczytu ciasteczek;
- nie odczytuje haseł, danych płatniczych ani tokenów logowania.

Strony Allegro otwierane przez rozszerzenie działają jak zwykłe karty przeglądarki, dlatego korzystają z normalnej sesji zalogowanego użytkownika.

Pełny opis znajduje się w [PRIVACY.md](./PRIVACY.md).

## Ograniczenia

Rozszerzenie odczytuje strukturę stron Allegro. Jeśli Allegro zmieni wygląd lub kod koszyka i list ofert, część funkcji może przestać działać do czasu aktualizacji.

Rozszerzenie nie omija CAPTCHA ani innych zabezpieczeń. Sortowanie i filtrowanie dotyczą ofert pobranych podczas bieżącego wyszukiwania, a nie od razu całego sklepu sprzedawcy.

---

## Dla autora — przygotowanie nowego Release

Ta część jest potrzebna tylko osobie rozwijającej projekt.

### Pierwsze uruchomienie

Wymagane są Node.js 20 lub nowszy i pnpm 10:

```powershell
corepack enable
pnpm install
```

### Gotowy ZIP jedną komendą

Najpierw ustaw numer wersji w `package.json`, na przykład `1.1.0`. Następnie uruchom:

```powershell
pnpm release
```

Skrypt automatycznie:

1. uruchomi testy;
2. sprawdzi typy TypeScript;
3. zbuduje rozszerzenie;
4. utworzy gotowy ZIP w folderze `release`.

Przykładowy wynik:

```text
release/dobierz-z-koszyka-v1.1.0.zip
```

Na GitHubie wybierz **Releases → Draft a new release**, wpisz tag zgodny z wersją, na przykład `v1.1.0`, przeciągnij ZIP do sekcji **Assets** i opublikuj Release.

### Pozostałe polecenia

```bash
pnpm dev          # uruchamia tryb developerski
pnpm build        # buduje rozszerzenie
pnpm test         # uruchamia testy
pnpm typecheck    # sprawdza typy
pnpm preview:ui   # pokazuje podgląd panelu
pnpm icons        # generuje ikony PNG z public/icon.svg
```

Projekt korzysta z Manifest V3, WXT, Vue 3 i TypeScript. Główne parsery stron Allegro znajdują się w:

- `adapters/allegro-cart.adapter.ts`;
- `adapters/allegro-offers.adapter.ts`.
