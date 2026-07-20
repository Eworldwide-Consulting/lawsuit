// Structured intake form field definitions, one "petitioner" (the person
// filing) + "subject" (the person the filing concerns) block per matter type.
// Petitioner fields are identical across all 4 case types — defined once and
// reused via withPrefix() instead of repeated per type. Subject fields vary
// (e.g. a decedent has a date of death, a ward has care needs) and are pulled
// from the section labels already seeded in checklist_templates (migration
// 003) and the source checklist PDFs.

const PETITIONER_FIELDS = [
  { key: 'name',         label: 'Full Legal Name',              type: 'text',     placeholder: 'Full legal name' },
  { key: 'relationship', label: 'Relationship to Protected Person', type: 'text',  placeholder: 'e.g. Parent, Sibling, Family Friend' },
  { key: 'dob',          label: 'Date of Birth',                 type: 'date' },
  { key: 'phone',        label: 'Phone Number',                  type: 'tel',      placeholder: '(555) 123-4567' },
  { key: 'email',        label: 'Email Address',                 type: 'email',    placeholder: 'name@email.com' },
  { key: 'address',      label: 'Home Address',                  type: 'textarea', placeholder: 'Street, city, state, ZIP' },
];

function withPrefix(fields, prefix) {
  return fields.map(f => ({ ...f, key: `${prefix}_${f.key}` }));
}

const FORM_SCHEMAS = {
  conservatorship: {
    petitionerLabel:  'Conservator Information',
    petitionerFields: withPrefix(PETITIONER_FIELDS, 'petitioner'),
    subjectLabel:     'Protected Person Information',
    subjectFields:    withPrefix([
      { key: 'name',      label: 'Full Legal Name',                       type: 'text',     placeholder: 'Protected person full legal name' },
      { key: 'dob',       label: 'Date of Birth',                         type: 'date' },
      { key: 'residence', label: 'Current Address and Living Arrangement', type: 'textarea', placeholder: 'Where do they currently live?' },
      { key: 'reason',    label: 'Reason Conservatorship is Being Requested', type: 'textarea', placeholder: 'Explain the need for financial protection or management' },
    ], 'subject'),
  },

  estate_administration: {
    petitionerLabel:  'Administrator Information',
    petitionerFields: withPrefix(PETITIONER_FIELDS, 'petitioner'),
    subjectLabel:     'Decedent Information',
    subjectFields:    withPrefix([
      { key: 'name',           label: 'Decedent Full Legal Name',   type: 'text',     placeholder: 'Decedent full legal name' },
      { key: 'date_of_death',  label: 'Date of Death',              type: 'date' },
      { key: 'residence',      label: 'Last Known Address / Domicile', type: 'textarea', placeholder: 'Last known address' },
      { key: 'marital_status', label: 'Marital Status at Death',    type: 'text',     placeholder: 'e.g. Married, Widowed, Single' },
    ], 'subject'),
  },

  guardianship: {
    petitionerLabel:  'Guardian Information',
    petitionerFields: withPrefix(PETITIONER_FIELDS, 'petitioner'),
    subjectLabel:     'Protected Person Information',
    subjectFields:    withPrefix([
      { key: 'name',               label: 'Full Name',          type: 'text',     placeholder: 'Protected person full legal name' },
      { key: 'dob',                label: 'Date of Birth',      type: 'date' },
      { key: 'residence',          label: 'Current Residence',  type: 'textarea', placeholder: 'Where do they currently live? (home, facility, etc.)' },
      { key: 'medical_conditions', label: 'Medical Conditions', type: 'textarea', placeholder: 'Diagnoses, conditions, or incapacities relevant to the case' },
      { key: 'care_needs',         label: 'Care Needs',         type: 'textarea', placeholder: 'Daily assistance, medical care, financial management needs…' },
      { key: 'current_caregiver',  label: 'Current Caregiver',  type: 'text',     placeholder: 'Who currently provides care?' },
    ], 'subject'),
  },

  joint_guardianship_conservatorship: {
    petitionerLabel:  'Guardian / Conservator Information',
    petitionerFields: withPrefix(PETITIONER_FIELDS, 'petitioner'),
    subjectLabel:     'Protected Person Information',
    subjectFields:    withPrefix([
      { key: 'name',      label: 'Full Legal Name',                       type: 'text',     placeholder: 'Protected person full legal name' },
      { key: 'dob',       label: 'Date of Birth',                         type: 'date' },
      { key: 'residence', label: 'Current Address and Living Arrangement', type: 'textarea', placeholder: 'Home, facility, hospital, assisted living, etc.' },
      { key: 'diagnosis', label: 'Disability, Incapacity, or Diagnosis Description', type: 'textarea', placeholder: 'Plain-English summary is acceptable at intake' },
      { key: 'reason',    label: 'Reason Guardianship / Conservatorship is Requested', type: 'textarea', placeholder: 'Explain why court involvement is needed' },
    ], 'subject'),
  },
};

// 'guardianship_conservatorship' is the UI/API key used elsewhere (matters,
// checklists); the schema map above uses the fuller 'joint_...' key —
// same mapping already applied in checklists.js's ensureItems().
function normalizeMatterType(matterType) {
  return matterType === 'guardianship_conservatorship'
    ? 'joint_guardianship_conservatorship'
    : matterType;
}

function getSchema(matterType) {
  return FORM_SCHEMAS[normalizeMatterType(matterType)] || null;
}

// All valid form_data keys for a matter type — used to whitelist incoming
// PUT payloads so arbitrary keys can't be written into the JSON blob.
function getFieldKeys(matterType) {
  const schema = getSchema(matterType);
  if (!schema) return [];
  return [...schema.petitionerFields, ...schema.subjectFields].map(f => f.key);
}

module.exports = { FORM_SCHEMAS, getSchema, getFieldKeys, normalizeMatterType };
