# Signature privée — préparation unique

Une signature Android identifie l'auteur de l'APK et permet les mises à jour.
**Conservez la même clé** : en perdre l'accès oblige généralement à désinstaller
l'application avant d'installer une nouvelle signature. N'utilisez pas de clé debug
publique et ne recréez pas une clé à chaque compilation.

## Codespaces

Dans le Codespace du **dépôt privé**, vérifiez `java -version`, `keytool -help` et
`gh --version`. Si Java manque, dans la palette de commandes :
**Codespaces: Add Dev Container Configuration Files → Modify your active configuration →
Java**, sélectionnez **17**, puis **Rebuild Container**. La configuration GitHub Actions
installe déjà Java 17 pour les compilations ; elle ne crée jamais de clé.

Lancez à la racine : `bash scripts/setup-signing.sh`.

- `keytool` demande le mot de passe du keystore, sa confirmation et celui de la clé.
  Les mots de passe sont **interactifs, masqués**, jamais passés en arguments.
- Notez ces mots de passe dans votre gestionnaire de mots de passe. Si vous acceptez
  le même mot de passe pour la clé avec Entrée, ressaisissez-le lors du transfert.
- Le script crée une clé RSA dans `$HOME/.creances-signing/creances-release.jks`,
  hors du dépôt. Il refuse de l'écraser si elle existe.
- Le script envoie la clé en base64 **directement via un pipe** à `gh secret set`,
  sans la montrer à l'écran ni écrire un fichier base64. Base64 n'est pas du chiffrement :
  ne copiez jamais ce contenu dans une conversation, un commit ou un journal.
- GitHub CLI doit avoir accès aux secrets du dépôt. Le jeton automatique de Codespaces
  peut ne pas avoir cette permission. Si le transfert est refusé, utilisez dans le terminal :
  `unset GH_TOKEN GITHUB_TOKEN`, puis `gh auth login --web`, et enfin
  `bash scripts/setup-signing.sh`. Suivez la connexion GitHub dans votre navigateur.
  Le script conserve la clé déjà créée ; ne la recréez pas.

Vérifiez dans **Settings → Secrets and variables → Actions** les quatre **noms**
(les valeurs ne sont pas consultables) :

1. `ANDROID_KEYSTORE_BASE64`
2. `ANDROID_KEYSTORE_PASSWORD`
3. `ANDROID_KEY_ALIAS` (le script utilise `creances`)
4. `ANDROID_KEY_PASSWORD`

Sauvegardez le fichier `.jks` dans un coffre chiffré sûr via l'explorateur du
Codespace (ouvrir `$HOME/.creances-signing`, puis Download) et sauvegardez ses mots de
passe séparément. Supprimez la copie du Codespace après sauvegarde vérifiée.
Ne commitez **jamais** ce dossier et n'envoyez ni clé ni mots de passe dans le chat.
Pour réutiliser votre clé existante, placez-la à cet emplacement avec l'alias
`creances` ; sinon enregistrez vos quatre secrets vous-même avec votre alias réel.

## Protection des compilations

Le workflow ne démarre que manuellement, exige les quatre secrets et échoue si l'un
manque. Il restaure la clé dans un fichier temporaire privé du runner, lit les mots
de passe par variables d'environnement puis efface la clé même en cas d'échec.
Il ne publie que l'APK signé (7 jours), jamais le keystore, les mots de passe,
les sources complètes, les caches Gradle ou des rapports de signature.

Limitez l'accès d'écriture au dépôt et vérifiez toute modification du workflow avant
de le lancer : une personne capable de modifier du code exécuté avec vos secrets
peut les détourner. Ne lancez pas ce workflow sur du code non fiable. Un dépôt privé
ne remplace pas cette vigilance. N'activez pas de traces shell (`set -x`) ni de
journaux Gradle détaillés pour diagnostiquer une erreur de signature.
