# Compiler avec Codemagic

Cette configuration s'applique au ZIP des sources Créances, pas à un autre projet.
Elle produit un APK release autonome avec le serveur de production et ne publie
sur aucun store. La compilation distante n'a pas encore été exécutée.

1. Dans GitHub, ajouter `codemagic.yaml` à la racine, à côté de `package.json`,
   avec **Add file → Create new file**, puis **Commit changes** sur `main`.
   Conserver `scripts/configure-release-signing.mjs`, déjà fourni dans les sources.
2. Dans Codemagic, ouvrir les paramètres de l'équipe →
   **codemagic.yaml settings → Code signing identities → Android keystores**.
3. Ajouter votre clé privée Android avec le nom de référence exact
   **creances_release**, son mot de passe, son alias et le mot de passe de la clé.
   Si aucune clé n'existe encore, en créer une une seule fois avec Java/keytool
   dans votre propre environnement :
   `keytool -genkeypair -keystore creances-release.jks -storetype JKS -alias creances -keyalg RSA -keysize 3072 -validity 10000`
   Les mots de passe se saisissent dans les invites masquées. Ne jamais les mettre
   dans GitHub, le YAML ou le chat. Sauvegarder la clé et ses mots de passe en lieu sûr.
   Réutiliser la même clé si un APK a déjà été distribué.
4. Revenir sur l'application Codemagic, choisir `main`, cliquer sur
   **Check for configuration file**, puis **Start new build** et choisir
   **Creances - APK Android**.
5. Après réussite, télécharger `app-release.apk` dans **Artifacts**.

Une clé manquante empêchera volontairement la compilation ; aucune clé debug
publique ne la remplacera. Seul l'APK est publié comme artefact, jamais la clé.
Le service peut consommer des crédits. Ne pas lancer la compilation sur du code
modifié par une personne non fiable, car le runner a accès à la signature.

Pour les mises à jour, garder le même identifiant et la même clé, augmenter
`android.versionCode`, puis recompiler. Aucun mot de passe du site ni identifiant
de base de données n'est nécessaire à la compilation.
