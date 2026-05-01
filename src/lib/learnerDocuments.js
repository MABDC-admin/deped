export const LEARNER_DOCUMENT_BUCKET = 'documents'

export const DOCUMENT_UPLOAD_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',')

export const DOCUMENT_FILE_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'

const DOCUMENT_ALIASES = {
  form137: ['form137', 'form_137', 'form 137', 'sf10', 'sf 10', 'permanent record', 'transcript'],
  form138: ['form138', 'form_138', 'form 138', 'sf9', 'sf 9', 'report card', 'report_card'],
  goodmoral: ['goodmoral', 'good_moral', 'good moral', 'character certificate'],
  enrollment: ['enrollment', 'enrollment certificate', 'proof of enrollment'],
  transfer: ['transfer', 'transfer_certificate', 'transfer certificate', 'transfer credentials'],
  diploma: ['diploma', 'completion certificate'],
  birth_certificate: ['birth_certificate', 'birth certificate', 'birth cert', 'psa nso', 'nso'],
  psa: ['psa', 'psa certificate'],
  medical_certificate: ['medical_certificate', 'medical certificate', 'medical'],
  id_photo: ['id_photo', 'id photo', '2x2', 'photo'],
  proof_of_address: ['proof_of_address', 'proof of address', 'address'],
}

export const normalizeDocumentToken = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const canonicalDocumentTypeId = (value = '') => {
  const normalized = normalizeDocumentToken(value)
  if (!normalized) return ''

  for (const [canonicalId, aliases] of Object.entries(DOCUMENT_ALIASES)) {
    const matchValues = [canonicalId, ...aliases].map(normalizeDocumentToken)
    if (matchValues.includes(normalized)) return canonicalId
  }

  return normalized.replace(/\s+/g, '_')
}

export const documentTypeMatches = (document, docType) =>
  canonicalDocumentTypeId(document?.document_type) === canonicalDocumentTypeId(docType?.id)

export const getDocumentRecord = (documents = [], docType) =>
  documents.find(doc => documentTypeMatches(doc, docType))

export const countSubmittedLearnerDocuments = (documents = [], docTypes = []) => {
  const submittedTypes = new Set(
    documents
      .filter(doc => doc?.is_submitted)
      .map(doc => canonicalDocumentTypeId(doc.document_type))
  )

  return docTypes.filter(docType => submittedTypes.has(canonicalDocumentTypeId(docType.id))).length
}

export const sanitizeFileName = (fileName = 'document') => {
  const cleaned = String(fileName)
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120)

  return cleaned || 'document'
}

export const buildLearnerDocumentPath = ({ studentId, enrollmentId, documentType, fileName }) => {
  const safeStudentId = studentId || 'unknown-student'
  const safeEnrollmentId = enrollmentId || 'unknown-enrollment'
  const safeDocumentType = canonicalDocumentTypeId(documentType || 'document') || 'document'
  const safeFileName = sanitizeFileName(fileName)

  return `learner-documents/${safeStudentId}/${safeEnrollmentId}/${safeDocumentType}/${Date.now()}-${safeFileName}`
}

export const getDocumentStoragePath = (document) => document?.file_path || document?.file_url || ''

export const formatFileSize = (bytes) => {
  const size = Number(bytes || 0)
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export const getDocumentContentType = (file) => {
  if (file?.type) return file.type

  const extension = String(file?.name || '').split('.').pop()?.toLowerCase()
  const fallbackTypes = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }

  return fallbackTypes[extension] || 'application/octet-stream'
}

export const inferDocumentTypeFromFileName = (fileName, docTypes = []) => {
  const normalizedName = normalizeDocumentToken(fileName)
  if (!normalizedName) return null

  return docTypes.find(docType => {
    const aliases = [docType.id, docType.name, ...(DOCUMENT_ALIASES[canonicalDocumentTypeId(docType.id)] || [])]
      .map(normalizeDocumentToken)
      .filter(Boolean)

    return aliases.some(alias => normalizedName.includes(alias))
  }) || null
}
