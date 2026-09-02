import http from './http';

const checklistApi = {
  /** Get all checklist items for a matter (grouped by section) */
  getByMatter: (matterId) =>
    http.get(`/checklists/matter/${matterId}`),

  /** Upload a file for a single checklist item */
  uploadFile: (itemId, file, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post(`/checklists/items/${itemId}/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  /** Attorney: accept | needs_correction | not_applicable */
  reviewItem: (itemId, action, correctionReason = '') =>
    http.put(`/checklists/items/${itemId}/review`, { action, correctionReason }),

  /** Attorney: get all submitted items across matters */
  getReviewQueue: () =>
    http.get('/checklists/review-queue'),

  /** Attorney: all clients with their matter and checklist readiness stats */
  clientOverview: () =>
    http.get('/checklists/client-overview'),

  /** Attorney: every checklist item with a file for a matter, any status —
   *  lets the attorney browse already-reviewed documents, not just pending ones */
  getAllItems: (matterId) =>
    http.get(`/checklists/matter/${matterId}/all-items`),

  /** Download / stream an uploaded file */
  downloadUrl: (itemId) => `/api/checklists/download/${itemId}`,
};

export default checklistApi;