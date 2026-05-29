import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./paginas/firebaseConfig";

const safeId = (value) => encodeURIComponent(String(value ?? "sin-id"));

const cleanForFirestore = (value) => {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cleanForFirestore);

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cleanForFirestore(item)])
  );
};

const syncDoc = async (path, data) => {
  try {
    await setDoc(doc(db, ...path), {
      ...cleanForFirestore(data),
      syncedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn("No se pudo sincronizar con Firebase:", error);
  }
};

const removeDoc = async (path) => {
  try {
    await deleteDoc(doc(db, ...path));
  } catch (error) {
    console.warn("No se pudo eliminar en Firebase:", error);
  }
};

export const firebaseSync = {
  user(user) {
    if (!user?.id && !user?.uid) return Promise.resolve();
    return syncDoc(["sondar_users", safeId(user.id || user.uid)], user);
  },

  profile(uid, profile) {
    return syncDoc(["sondar_users", safeId(uid), "profile", "main"], profile);
  },

  settings(uid, settings) {
    return syncDoc(["sondar_users", safeId(uid), "settings", "main"], settings);
  },

  savedItem(uid, itemType, itemId, itemData) {
    return syncDoc(
      ["sondar_users", safeId(uid), "saved_items", `${safeId(itemType)}__${safeId(itemId)}`],
      { itemType, itemId: String(itemId), itemData }
    );
  },

  removeSavedItem(uid, itemType, itemId) {
    return removeDoc([
      "sondar_users",
      safeId(uid),
      "saved_items",
      `${safeId(itemType)}__${safeId(itemId)}`,
    ]);
  },

  interaction(uid, payload) {
    return syncDoc(
      [
        "sondar_users",
        safeId(uid),
        "interactions",
        `${safeId(payload.itemType)}__${safeId(payload.itemId)}__${safeId(payload.interactionType)}`,
      ],
      payload
    );
  },

  publication(uid, publication) {
    return syncDoc(
      ["sondar_users", safeId(uid), "publications", safeId(publication.id || publication.nombre)],
      publication
    );
  },

  event(event) {
    return syncDoc(["sondar_events", safeId(event.id || event.titulo)], event);
  },

  thread(thread) {
    return syncDoc(["sondar_threads", safeId(thread.id || thread.titulo)], thread);
  },

  comment(threadId, comment) {
    return syncDoc(
      ["sondar_threads", safeId(threadId), "comments", safeId(comment.id || comment.texto)],
      comment
    );
  },

  catalog(collectionName, items) {
    if (!Array.isArray(items)) return Promise.resolve();
    return Promise.all(
      items.map((item) =>
        syncDoc(["sondar_catalog", safeId(collectionName), "items", safeId(item.id || item.nombre || item.titulo)], item)
      )
    );
  },
};
