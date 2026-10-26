// Resolve writes after their transaction commits, including abort/quota failures.
(function (root) {
  const ready = new Promise((resolve, reject) => {
    const request = indexedDB.open("sideline-boards", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("boards")) db.createObjectStore("boards", { keyPath: "slot" });
      if (!db.objectStoreNames.contains("workspace")) db.createObjectStore("workspace", { keyPath: "key" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || Error("Local storage is unavailable."));
    request.onblocked = () => reject(Error("Close older Sideline windows, then reopen to update local storage."));
  });
  ready.catch(() => {});
  root.SIDELINE_STORE = {
    async putAll(store, values) {
      const db = await ready;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        values.forEach((value) => tx.objectStore(store).put(value));
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error || Error("The import did not complete."));
      });
    },
    async run(store, method, value) {
      const db = await ready;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, method === "get" || method === "getAll" ? "readonly" : "readwrite");
        let result;
        const request = value === undefined ? tx.objectStore(store)[method]() : tx.objectStore(store)[method](value);
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(tx.error || request.error || Error("The local save did not complete."));
      });
    },
  };
})(window);
