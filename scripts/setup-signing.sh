#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077
command -v keytool >/dev/null || { echo "JDK requis : utilisez un Codespace avec Java 17 (voir SIGNATURE.md)."; exit 1; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) requis dans le Codespace."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Authentification GitHub CLI requise (gh auth login)."; exit 1; }
directory="$HOME/.creances-signing"
mkdir -p "$directory"
chmod 700 "$directory"
keystore="$directory/creances-release.jks"
if [ -e "$keystore" ]; then
  echo "Clé existante conservée : $keystore"
else
  echo "Création unique de votre clé. Saisissez un mot de passe robuste dans l'invite keytool (saisie masquée)."
  keytool -genkeypair -v -keystore "$keystore" -storetype JKS -alias creances \
    -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Creances Android"
fi
echo "Transfert chiffré de la clé vers le secret GitHub du dépôt courant (aucune clé affichée)."
base64 -w 0 "$keystore" | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' creances | gh secret set ANDROID_KEY_ALIAS
read -r -s -p "Mot de passe du keystore : " store_password
printf '\n'
printf '%s' "$store_password" | gh secret set ANDROID_KEYSTORE_PASSWORD
unset store_password
read -r -s -p "Mot de passe de la clé (identique si Entrée dans keytool) : " key_password
printf '\n'
printf '%s' "$key_password" | gh secret set ANDROID_KEY_PASSWORD
unset key_password
echo "Secrets enregistrés. Sauvegardez le keystore et ses mots de passe hors GitHub avant de supprimer le Codespace."
echo "Fichier privé : $keystore (ne jamais le committer ni l'envoyer dans un chat)."
