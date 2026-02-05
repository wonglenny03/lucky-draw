/**
 * 使用 IndexedDB 存储本地音频文件，不占用 localStorage 配额。
 * 支持大文件，刷新后仍可读取。
 */

const DB_NAME = 'AnnualDrawMedia';
const STORE_NAME = 'audio';
const VERSION = 1;

export const AUDIO_KEYS = {
  backgroundMusic: 'backgroundMusic',
  drawMusic: 'drawMusic',
  winnerSound: 'winnerSound',
} as const;

export type AudioKey = keyof typeof AUDIO_KEYS;

export const INDEXEDDB_MARKER_PREFIX = 'indexeddb:';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export interface StoredAudio {
  buffer: ArrayBuffer;
  type: string;
}

/** 将本地 MP3 文件存入 IndexedDB */
export function putAudio(key: AudioKey, file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      openDB()
        .then((db) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({ buffer, type: file.type || 'audio/mpeg' }, AUDIO_KEYS[key]);
          tx.oncomplete = () => {
            db.close();
            const blob = new Blob([buffer], { type: file.type || 'audio/mpeg' });
            resolve(URL.createObjectURL(blob));
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        })
        .catch(reject);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** 从 IndexedDB 读取并返回可播放的 blob URL */
export function getBlobURL(key: AudioKey): Promise<string | undefined> {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(AUDIO_KEYS[key]);
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
      req.onsuccess = () => {
        db.close();
        const entry = req.result as StoredAudio | undefined;
        if (!entry?.buffer) {
          resolve(undefined);
          return;
        }
        const blob = new Blob([entry.buffer], { type: entry.type || 'audio/mpeg' });
        resolve(URL.createObjectURL(blob));
      };
    });
  });
}

/** 判断是否为 IndexedDB 标记（需要从 IndexedDB 加载） */
export function isIndexedDBMarker(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith(INDEXEDDB_MARKER_PREFIX);
}

/** 根据 key 生成要存入 localStorage 的标记 */
export function getMarker(key: AudioKey): string {
  return INDEXEDDB_MARKER_PREFIX + AUDIO_KEYS[key];
}

/** 从标记解析出 AudioKey */
export function getKeyFromMarker(marker: string): AudioKey | null {
  if (!marker.startsWith(INDEXEDDB_MARKER_PREFIX)) return null;
  const k = marker.slice(INDEXEDDB_MARKER_PREFIX.length);
  if (k === AUDIO_KEYS.backgroundMusic) return 'backgroundMusic';
  if (k === AUDIO_KEYS.drawMusic) return 'drawMusic';
  if (k === AUDIO_KEYS.winnerSound) return 'winnerSound';
  return null;
}
