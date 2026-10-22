# Créances — sources Android et compilation en ligne

Ce ZIP contient les **sources non compilées**, pas un APK. L'application Android
utilise le service existant https://architecture-mentor.replit.app ; le serveur,
les données et les secrets ne sont pas inclus. Vos identifiants de connexion habituels restent nécessaires.

## Tout faire dans le navigateur, sans Android Studio

1. Créez un dépôt GitHub **privé** avec un README pour l'initialiser, puis ouvrez **Code → Codespaces → Create codespace**.
2. Glissez ce ZIP dans l'explorateur du Codespace. Dans le terminal, décompressez-le
   à la racine du dépôt (`unzip -o creances-android-source.zip`), puis supprimez ce ZIP.
   La racine doit contenir `package.json`, `artifacts`, `lib` et `.github`.
3. Créez votre signature **une seule fois** : suivez [SIGNATURE.md](SIGNATURE.md),
   puis lancez `bash scripts/setup-signing.sh`. Aucun secret à envoyer dans un chat.
4. Dans l'onglet Source Control du Codespace, validez et poussez uniquement les
   fichiers sources (jamais de clé ni de mot de passe).
5. Sur GitHub : **Actions → Compiler APK Android → Run workflow**.
   Si GitHub le demande, activez Actions pour ce dépôt. Attendez la fin du travail.
6. Dans la page de cette exécution, téléchargez l'artefact **creances-android-apk**,
   décompressez-le et installez `app-release.apk` sur votre téléphone Android.
   Autorisez l'installation depuis votre navigateur/fichiers lorsque Android le demande.

L'APK release contient son JavaScript : **ni Expo Go ni serveur Metro nécessaires**.
GitHub fournit le runner Ubuntu et le SDK Android ; la compilation peut prendre
plusieurs dizaines de minutes et consomme votre quota Actions/Codespaces.
Aucune compilation distante n'est garantie tant que votre exécution n'a pas réussi.

Pour une mise à jour, gardez la même clé et le même identifiant `ch.creances.mobile`,
augmentez `android.versionCode` dans `artifacts/creances-mobile/app.json`, puis relancez Actions.
Ne remplacez pas la signature release par la signature debug en cas d'échec.
