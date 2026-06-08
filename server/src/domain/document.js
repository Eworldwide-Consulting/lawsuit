const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

const DOCUMENT_STATUSES = Object.freeze(['pending', 'uploaded', 'approved', 'rejected']);

const MAX_FILE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 20) * 1024 * 1024;

module.exports = { ALLOWED_EXTENSIONS, DOCUMENT_STATUSES, MAX_FILE_BYTES };