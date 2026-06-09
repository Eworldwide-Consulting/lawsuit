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

  /** Download / stream an uploaded file */
  downloadUrl: (itemId) => `/api/checklists/download/${itemId}`,
};

export default checklistApi;