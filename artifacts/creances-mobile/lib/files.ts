import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ'));
    reader.onload = () => {
      const r = String(reader.result ?? '');
      const i = r.indexOf(',');
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.readAsDataURL(blob);
  });
}

export class ShareUnavailableError extends Error {}

/** Écrit le fichier dans le cache de l'app puis ouvre la feuille de partage Android (web : téléchargement). */
export async function saveAndShare(name: string, mimeType: string, data: string | Blob, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new ShareUnavailableError('share');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  if (typeof data === 'string') {
    file.write(data);
  } else {
    file.write(await blobToBase64(data), { encoding: 'base64' });
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}
