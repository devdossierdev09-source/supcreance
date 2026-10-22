import { readFile, writeFile } from 'node:fs/promises';

const file = 'artifacts/creances-mobile/android/app/build.gradle';
let gradle = await readFile(file, 'utf8');
// Fail closed when the Expo template changes: never fall back to debug signing.
const release = /release\s*\{\s*\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/;
if (!release.test(gradle) || !gradle.includes('    signingConfigs {')) {
  throw new Error('Modèle Gradle inattendu : signature release non configurée. Ne pas compiler avec la clé debug.');
}
gradle = gradle.replace('    signingConfigs {', `    signingConfigs {
        release {
            def required = { name ->
                def value = System.getenv(name)
                if (!value) throw new GradleException("Secret de signature requis : " + name)
                return value
            }
            storeFile file(required("ANDROID_KEYSTORE_PATH"))
            storePassword required("ANDROID_KEYSTORE_PASSWORD")
            keyAlias required("ANDROID_KEY_ALIAS")
            keyPassword required("ANDROID_KEY_PASSWORD")
        }`);
gradle = gradle.replace(release, 'release {\n            signingConfig signingConfigs.release');
await writeFile(file, gradle);
console.log('Signature release configurée ; aucun mot de passe écrit dans le projet.');
