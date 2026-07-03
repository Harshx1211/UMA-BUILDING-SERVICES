const pending = new Map();

async function toDataUri(url, fail) {
  if (pending.has(url)) {
    console.log("Returning pending promise for", url);
    return pending.get(url);
  }

  const promise = (async () => {
    console.log("Starting download for", url);
    await new Promise(r => setTimeout(r, 100)); // simulate network
    if (fail) throw new Error("Network abort");
    return "base64data";
  })();

  pending.set(url, promise);
  try {
    return await promise;
  } catch (err) {
    console.warn('Caught in toDataUri:', err.message);
    return null;
  } finally {
    pending.delete(url);
  }
}

async function run() {
  try {
    const urls = ['http://fail', 'http://fail'];
    const results = await Promise.all(
      urls.map(u => toDataUri(u, true).then(res => res ?? 'fallback'))
    );
    console.log("Promise.all succeeded:", results);
  } catch (err) {
    console.error("Promise.all failed! Uncaught rejection bubble:", err.message);
  }
}

run();
