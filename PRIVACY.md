# Prywatność

„Dobierz z koszyka” działa lokalnie w przeglądarce. Nie ma backendu i nie wysyła historii zakupów ani zawartości koszyka do autora rozszerzenia lub innych usług.

Rozszerzenie:

- odczytuje z DOM strony Allegro wyłącznie loginy sprzedawców i stan zaznaczenia produktów;
- otwiera publiczne strony wyszukiwania sprzedawców kolejno w zwykłych kartach, odczytuje ich gotowy DOM i zamyka kartę po zapisaniu wyników;
- nie odczytuje ciasteczek, haseł, tokenów ani danych płatniczych;
- zapisuje ustawienia lokalnie w `chrome.storage.local`, a oczekujące wyszukiwanie tymczasowo w `chrome.storage.session`;
- nie używa analityki, zdalnego kodu ani zewnętrznych serwerów.

Użytkownik może usunąć dane rozszerzenia przez usunięcie rozszerzenia lub wyczyszczenie jego danych w ustawieniach przeglądarki.
