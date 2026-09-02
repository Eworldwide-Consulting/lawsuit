// Shared helpers for viewing/downloading files served by authenticated API
// routes. Auth here is a Bearer token in localStorage, attached only by an
// axios interceptor — a plain <a href="/api/..."> navigation never carries
// it, so it hits a 401 instead of the real file. These fetch the file
// through the authenticated axios instance (as a blob) instead.
//
// Pass the axios call itself (e.g. documentsApi.viewBlob(id)), not its
// result — the popup window must open synchronously inside the caller's
// click handler, before the await, or browsers' popup blockers kill it.

export async function viewFileInPopup(blobRequestPromise) {
  const popup = window.open('', '_blank', 'width=900,height=1000,noopener,noreferrer');
  if (!popup) {
    throw Object.assign(new Error('Please allow pop-ups for this site to view documents.'), { code: 'POPUP_BLOCKED' });
  }
  popup.document.write('<p style="font:14px sans-serif;padding:20px">Loading document…</p>');
  try {
    const res = await blobRequestPromise;
    const blobUrl = URL.createObjectURL(res.data);
    popup.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (err) {
    popup.close();
    throw err;
  }
}

export async function downloadFile(blobRequestPromise, filename) {
  const res = await blobRequestPromise;
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
