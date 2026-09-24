#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
package_path="$project_root/package.json"
release_directory="$project_root/release"
staging_directory=""

run_pnpm() {
	if command -v pnpm >/dev/null 2>&1; then
		pnpm "$@"
	elif command -v corepack >/dev/null 2>&1; then
		corepack pnpm "$@"
	else
		echo "Nie znaleziono pnpm ani corepack." >&2
		exit 1
	fi
}

run_step() {
	local name="$1"
	shift

	echo
	echo "==> $name"
	"$@"
}

cleanup() {
	if [[ -n "$staging_directory" && "$staging_directory" == "$release_directory"/.staging-* ]]; then
		rm -rf -- "$staging_directory"
	fi
}

trap cleanup EXIT

if ! command -v node >/dev/null 2>&1; then
	echo "Nie znaleziono Node.js." >&2
	exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
	echo "Nie znaleziono programu zip. Na Ubuntu zainstaluj go poleceniem: sudo apt install zip" >&2
	exit 1
fi

version="$(node -p "require(process.argv[1]).version" "$package_path")"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
	echo "Nieprawidłowa wersja w package.json: '$version'." >&2
	exit 1
fi

cd -- "$project_root"

run_step "Testy" run_pnpm test
run_step "Sprawdzanie typów" run_pnpm typecheck
run_step "Build dla Chrome / Edge i Opery" run_pnpm build

target_names=("Chrome / Edge" "Opera")
build_directories=(
	"$project_root/.output/chrome-mv3"
	"$project_root/.output/opera-mv3"
)
archive_names=(
	"dopakuj-extension-chrome-edge-v$version.zip"
	"dopakuj-extension-opera-v$version.zip"
)
extension_directory_names=(
	"DopakujExtension-ChromeEdge"
	"DopakujExtension-Opera"
)

for index in "${!target_names[@]}"; do
	manifest_path="${build_directories[$index]}/manifest.json"
	if [[ ! -f "$manifest_path" ]]; then
		echo "Build dla ${target_names[$index]} nie zawiera pliku manifest.json: $manifest_path" >&2
		exit 1
	fi
done

mkdir -p -- "$release_directory"
staging_directory="$release_directory/.staging-$version-linux"
rm -rf -- "$staging_directory"
mkdir -p -- "$staging_directory"

for index in "${!target_names[@]}"; do
	archive_path="$release_directory/${archive_names[$index]}"
	extension_directory="$staging_directory/${extension_directory_names[$index]}"

	rm -f -- "$archive_path"
	mkdir -p -- "$extension_directory"
	cp -a -- "${build_directories[$index]}/." "$extension_directory/"

	echo
	echo "==> Pakowanie ZIP dla ${target_names[$index]}"
	(
		cd -- "$staging_directory"
		zip -q -r "$archive_path" "${extension_directory_names[$index]}"
	)
done

echo
echo "Gotowe:"
for archive_name in "${archive_names[@]}"; do
	echo "$release_directory/$archive_name"
done
echo
echo "Te pliki dodaj do Assets w GitHub Release."
