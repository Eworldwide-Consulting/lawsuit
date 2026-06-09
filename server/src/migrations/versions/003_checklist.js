// Creates checklist_templates and matter_checklist_items tables.
// Seeds baseline templates for all 4 matter types extracted from the TriVanta
// General Checklists (Conservatorship, Estate Administration, Guardianship,
// Joint Guardianship & Conservatorship).

exports.up = async function ({ run, all, dbType }) {
  const auto = dbType === 'mysql' ? 'BIGINT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY';
  const fk   = dbType === 'mysql' ? 'BIGINT' : 'INTEGER';

  // ── Template items (static reference data, seeded below) ──────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id             ${auto},
      matter_type    VARCHAR(64)  NOT NULL,
      section        VARCHAR(128) NOT NULL,
      section_order  INTEGER      NOT NULL DEFAULT 0,
      label          TEXT         NOT NULL,
      description    TEXT,
      default_status VARCHAR(32)  NOT NULL DEFAULT 'if_available',
      item_order     INTEGER      NOT NULL DEFAULT 0,
      created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Per-matter checklist items (client + attorney workflow) ────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS matter_checklist_items (
      id             ${auto},
      matter_id      ${fk}        NOT NULL,
      template_id    ${fk},
      section        VARCHAR(128) NOT NULL,
      section_order  INTEGER      NOT NULL DEFAULT 0,
      label          TEXT         NOT NULL,
      description    TEXT,
      default_status VARCHAR(32)  NOT NULL DEFAULT 'if_available',
      status         VARCHAR(32)  NOT NULL DEFAULT 'if_available',
      item_order     INTEGER      NOT NULL DEFAULT 0,
      file_name      VARCHAR(255),
      file_path      VARCHAR(512),
      file_size      INTEGER,
      file_mime      VARCHAR(128),
      attorney_notes TEXT,
      reviewed_by    ${fk},
      reviewed_at    DATETIME,
      created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes
  const indexes = [
    `CREATE INDEX idx_cl_template_type ON checklist_templates (matter_type)`,
    `CREATE INDEX idx_cl_items_matter  ON matter_checklist_items (matter_id)`,
    `CREATE INDEX idx_cl_items_status  ON matter_checklist_items (matter_id, status)`,
  ];
  for (const sql of indexes) {
    try { await run(sql); } catch (err) {
      const msg = (err.message || '').toLowerCase();
      if (err.errno === 1061 || msg.includes('already exists') || msg.includes('duplicate')) continue;
      throw err;
    }
  }

  // ── Seed template data ─────────────────────────────────────────────────────
  // Only insert if the table is empty (idempotent re-runs)
  const existing = await all(`SELECT id FROM checklist_templates LIMIT 1`);
  if (existing.length > 0) return;

  const templates = buildTemplates();

  for (const t of templates) {
    await run(
      `INSERT INTO checklist_templates (matter_type, section, section_order, label, description, default_status, item_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [t.matterType, t.section, t.sectionOrder, t.label, t.description, t.defaultStatus, t.itemOrder]
    );
  }
};

// ── Template data ──────────────────────────────────────────────────────────
function buildTemplates() {
  const rows = [];
  let id = 0;
  const add = (matterType, section, sectionOrder, label, description, defaultStatus, itemOrder) => {
    rows.push({ id: ++id, matterType, section, sectionOrder, label, description, defaultStatus, itemOrder });
  };

  // ── CONSERVATORSHIP ────────────────────────────────────────────────────────
  const CON = 'conservatorship';
  add(CON, 'Court and Legal Documents', 1, 'Petition or application for conservatorship', 'Shows the request filed with the court and the basis for the case.', 'needed_now', 1);
  add(CON, 'Court and Legal Documents', 1, 'Court order appointing conservator', 'Shows the appointment and any limits on authority.', 'if_available', 2);
  add(CON, 'Court and Legal Documents', 1, 'Letters of conservatorship / certificate of appointment', 'Used to prove authority to banks, agencies, and third parties.', 'if_available', 3);
  add(CON, 'Court and Legal Documents', 1, 'Case number, court, and county information', 'Allows the firm to connect documents and deadlines to the correct matter.', 'needed_now', 4);
  add(CON, 'Court and Legal Documents', 1, 'Bond order, bond certificate, or bond waiver', 'Documents whether bond is required and the amount.', 'if_available', 5);
  add(CON, 'Court and Legal Documents', 1, 'Training certificate or fiduciary education proof', 'Some courts require conservator training.', 'if_available', 6);

  add(CON, 'Conservator Information', 2, 'Conservator full legal name', 'Identifies the person seeking or holding fiduciary authority.', 'needed_now', 1);
  add(CON, 'Conservator Information', 2, 'Government ID', 'Verifies identity for firm and court records.', 'needed_now', 2);
  add(CON, 'Conservator Information', 2, 'Address, phone, and email', 'Allows the firm and court to contact the conservator.', 'needed_now', 3);
  add(CON, 'Conservator Information', 2, 'Relationship to protected person', 'Helps explain standing, involvement, and possible conflicts.', 'needed_now', 4);

  add(CON, 'Protected Person Information', 3, 'Protected person full legal name', 'Identifies the person whose estate is being protected.', 'needed_now', 1);
  add(CON, 'Protected Person Information', 3, 'Date of birth', 'May be required for court, benefits, and account identification.', 'needed_now', 2);
  add(CON, 'Protected Person Information', 3, 'Current address and living arrangement', 'Helps explain where the protected person lives and their care context.', 'needed_now', 3);
  add(CON, 'Protected Person Information', 3, 'Reason conservatorship is being requested', 'Explains the need for financial protection or management.', 'needed_now', 4);

  add(CON, 'Initial Inventory and Estate Information', 4, 'List of all assets and estimated values', 'Foundation for the initial inventory and future accountings.', 'needed_now', 1);
  add(CON, 'Initial Inventory and Estate Information', 4, 'Beginning account balances', 'Establishes financial baseline for the accounting period.', 'if_available', 2);
  add(CON, 'Initial Inventory and Estate Information', 4, 'Safe deposit box information', 'May contain cash, deeds, titles, jewelry, or documents.', 'if_available', 3);

  add(CON, 'Banking and Financial Records', 5, 'Bank statements for all accounts', 'Shows balances, deposits, withdrawals, and account activity.', 'needed_now', 1);
  add(CON, 'Banking and Financial Records', 5, 'Direct deposit records', 'Helps identify recurring income and benefits.', 'if_available', 2);
  add(CON, 'Banking and Financial Records', 5, 'Checkbook registers or check images', 'Supports disbursement review and payment tracking.', 'if_available', 3);

  add(CON, 'Income and Benefits', 6, 'Social Security, SSI, or SSDI award / benefit letters', 'Documents recurring benefits and income.', 'if_available', 1);
  add(CON, 'Income and Benefits', 6, 'Pension or retirement distribution statements', 'Documents recurring retirement income.', 'if_available', 2);
  add(CON, 'Income and Benefits', 6, 'VA, disability, or public benefit records', 'Identifies public benefits and restrictions.', 'if_available', 3);

  add(CON, 'Expenses and Disbursements', 7, 'Receipts and invoices', 'Supports expenses and reimbursement requests.', 'needed_now', 1);
  add(CON, 'Expenses and Disbursements', 7, 'Housing, rent, mortgage, or facility bills', 'Documents living expenses.', 'if_available', 2);
  add(CON, 'Expenses and Disbursements', 7, 'Medical, pharmacy, therapy, or care bills', 'Documents health and care expenses.', 'if_available', 3);

  add(CON, 'Debts and Liabilities', 8, 'Mortgage statements', 'Documents real estate debt.', 'if_available', 1);
  add(CON, 'Debts and Liabilities', 8, 'Credit card statements', 'Documents revolving debt and spending.', 'if_available', 2);
  add(CON, 'Debts and Liabilities', 8, 'Tax debts, liens, judgments, or collection notices', 'Documents legal or financial obligations.', 'if_available', 3);

  add(CON, 'Annual Accounting Readiness', 9, 'Transaction ledger for the accounting period', 'Tracks all receipts and disbursements.', 'needed_now', 1);
  add(CON, 'Annual Accounting Readiness', 9, 'Beginning and ending account balances', 'Shows funds at start and end of period.', 'needed_now', 2);
  add(CON, 'Annual Accounting Readiness', 9, 'Schedule of receipts / income', 'Summarizes money received during the period.', 'needed_now', 3);
  add(CON, 'Annual Accounting Readiness', 9, 'Schedule of disbursements / expenses', 'Summarizes money spent during the period.', 'needed_now', 4);

  // ── ESTATE ADMINISTRATION ─────────────────────────────────────────────────
  const EST = 'estate_administration';
  add(EST, 'Court and Probate Documents', 1, 'Certified death certificate', 'Often required to open probate or administer assets.', 'needed_now', 1);
  add(EST, 'Court and Probate Documents', 1, 'Will, codicil, trust, or estate planning documents', 'Upload all known versions; attorney will determine what applies.', 'if_available', 2);
  add(EST, 'Court and Probate Documents', 1, 'Letters testamentary / letters of administration', 'Usually available after court appointment.', 'if_available', 3);
  add(EST, 'Court and Probate Documents', 1, 'Court order appointing executor / administrator', 'Upload once issued by the court.', 'if_available', 4);
  add(EST, 'Court and Probate Documents', 1, 'Case number, court, and county information', 'Required for existing cases; optional for new matters.', 'if_available', 5);

  add(EST, 'Administrator Information', 2, 'Administrator full legal name', 'Identifies the person seeking or holding authority.', 'needed_now', 1);
  add(EST, 'Administrator Information', 2, 'Government ID for administrator', 'Driver license, passport, or state ID.', 'needed_now', 2);
  add(EST, 'Administrator Information', 2, 'Administrator contact information', 'Address, phone, email.', 'needed_now', 3);
  add(EST, 'Administrator Information', 2, 'Relationship to decedent', 'Family, named executor, creditor, professional fiduciary, etc.', 'needed_now', 4);
  add(EST, 'Administrator Information', 2, 'Estate bank account information', 'Do not commingle funds; attorney/accountant can advise.', 'if_available', 5);

  add(EST, 'Decedent Information', 3, 'Decedent full legal name', 'Required for every estate intake.', 'needed_now', 1);
  add(EST, 'Decedent Information', 3, 'Date of death', 'Usually needed for court and asset valuation.', 'needed_now', 2);
  add(EST, 'Decedent Information', 3, 'Last known address / domicile', 'Helps determine venue and jurisdiction.', 'needed_now', 3);
  add(EST, 'Decedent Information', 3, 'Marital status at death', 'Important for heirs, spouse rights, and benefits.', 'needed_now', 4);

  add(EST, 'Heirs and Beneficiaries', 4, 'Names and contact information for heirs', 'Include spouse, children, parents, siblings, or other heirs.', 'needed_now', 1);
  add(EST, 'Heirs and Beneficiaries', 4, 'Names and contact information for beneficiaries', 'From will, trust, beneficiary designations, or known estate plan.', 'if_available', 2);
  add(EST, 'Heirs and Beneficiaries', 4, 'Family tree or heirship summary', 'Helpful when there is no will or heirs are unclear.', 'if_available', 3);

  add(EST, 'Asset Inventory', 5, 'List of all known assets and estimated values', 'Baseline estate inventory.', 'needed_now', 1);
  add(EST, 'Asset Inventory', 5, 'Bank statements and account records', 'Checking, savings, CDs, money market, credit union accounts.', 'needed_now', 2);
  add(EST, 'Asset Inventory', 5, 'Real estate deeds or ownership documents', 'Homes, land, rental property, timeshare.', 'if_available', 3);
  add(EST, 'Asset Inventory', 5, 'Vehicle titles, registration, and estimated values', 'Cars, trucks, motorcycles, RVs, boats.', 'if_available', 4);
  add(EST, 'Asset Inventory', 5, 'Stocks, bonds, brokerage, or investment statements', 'Include date-of-death values if available.', 'if_available', 5);
  add(EST, 'Asset Inventory', 5, 'Retirement account statements', 'IRA, 401(k), pension, annuity; confirm beneficiaries.', 'if_available', 6);
  add(EST, 'Asset Inventory', 5, 'Life insurance policy information', 'Policy, beneficiary, claim status; may or may not be probate asset.', 'if_available', 7);
  add(EST, 'Asset Inventory', 5, 'Digital assets and online accounts', 'Crypto, online business accounts, domain names, payment accounts.', 'if_available', 8);

  add(EST, 'Debts, Bills, and Claims', 6, 'Mortgage statements', 'Include current balance and property tied to debt.', 'if_available', 1);
  add(EST, 'Debts, Bills, and Claims', 6, 'Medical bills and final illness expenses', 'Hospitals, doctors, pharmacies, care facilities.', 'if_available', 2);
  add(EST, 'Debts, Bills, and Claims', 6, 'Funeral, burial, or cremation expense records', 'Invoices and proof of payment.', 'if_available', 3);
  add(EST, 'Debts, Bills, and Claims', 6, 'Tax notices, IRS / state letters, or unpaid tax information', 'Income, property, estate, gift, payroll, business taxes.', 'if_available', 4);
  add(EST, 'Debts, Bills, and Claims', 6, 'Creditor claims, collection letters, lawsuits, or judgments', 'Attorney review needed.', 'if_available', 5);

  add(EST, 'Tax and Income Documents', 7, 'Prior federal and state tax returns', 'Most recent one to three years, if known.', 'if_available', 1);
  add(EST, 'Tax and Income Documents', 7, 'W-2, 1099, K-1, pension, or benefit statements', 'Useful for final income tax return.', 'if_available', 2);

  add(EST, 'Accounting and Closing', 8, 'Estate transaction ledger', 'Track all receipts and disbursements.', 'upload_later', 1);
  add(EST, 'Accounting and Closing', 8, 'Asset sale documents and closing statements', 'Real estate, vehicles, stocks, personal property.', 'upload_later', 2);
  add(EST, 'Accounting and Closing', 8, 'Beneficiary receipts, releases, or waivers', 'Needed to document distributions.', 'upload_later', 3);
  add(EST, 'Accounting and Closing', 8, 'Final accounting and petition for discharge / closure', 'Generally prepared at closing.', 'upload_later', 4);

  add(EST, 'Additional Supporting Documents', 9, 'Trust documents and trustee contact information', 'Some assets may be trust assets rather than probate assets.', 'if_available', 1);
  add(EST, 'Additional Supporting Documents', 9, 'Beneficiary designation forms', 'Retirement, life insurance, payable-on-death / transfer-on-death assets.', 'if_available', 2);
  add(EST, 'Additional Supporting Documents', 9, 'Notes about missing documents or unknown information', 'Use this to tell legal team what is unavailable or uncertain.', 'needed_now', 3);

  // ── GUARDIANSHIP ──────────────────────────────────────────────────────────
  const GRD = 'guardianship';
  add(GRD, 'Court and Legal Documents', 1, 'Petition for guardianship', 'May be prepared by attorney or already filed.', 'needed_now', 1);
  add(GRD, 'Court and Legal Documents', 1, 'Court order appointing guardian', 'Needed once court has entered an order.', 'if_available', 2);
  add(GRD, 'Court and Legal Documents', 1, 'Letters of guardianship', 'Confirms authority to act as guardian.', 'if_available', 3);
  add(GRD, 'Court and Legal Documents', 1, 'Temporary or emergency guardianship order', 'Include if temporary authority exists.', 'if_available', 4);
  add(GRD, 'Court and Legal Documents', 1, 'Current case number and court / county information', 'Helpful for existing matters.', 'if_available', 5);
  add(GRD, 'Court and Legal Documents', 1, 'Attorney contact information', 'Name, firm, phone, and email if known.', 'needed_now', 6);

  add(GRD, 'Guardian Information', 2, 'Guardian full legal name', 'Name of person seeking or serving as guardian.', 'needed_now', 1);
  add(GRD, 'Guardian Information', 2, 'Guardian government ID', 'Driver license, state ID, passport, or other ID.', 'needed_now', 2);
  add(GRD, 'Guardian Information', 2, 'Guardian address, phone, and email', 'Used for portal access and updates.', 'needed_now', 3);
  add(GRD, 'Guardian Information', 2, 'Relationship to protected person', 'Family, caregiver, professional, or other relationship.', 'needed_now', 4);

  add(GRD, 'Protected Person Information', 3, 'Protected person full legal name', 'Name of person who may need a guardian.', 'needed_now', 1);
  add(GRD, 'Protected Person Information', 3, 'Protected person date of birth', 'Usually important for court and care records.', 'needed_now', 2);
  add(GRD, 'Protected Person Information', 3, 'Current address and living arrangement', 'Where the protected person currently lives.', 'needed_now', 3);
  add(GRD, 'Protected Person Information', 3, 'Disability, diagnosis, or incapacity description', 'Plain-English summary is acceptable at intake.', 'needed_now', 4);
  add(GRD, 'Protected Person Information', 3, 'Reason guardianship is being requested', 'Explain why help is needed.', 'needed_now', 5);

  add(GRD, 'Medical and Capacity Information', 4, 'Physician evaluation', 'May be required or requested by court / attorney.', 'needed_now', 1);
  add(GRD, 'Medical and Capacity Information', 4, 'Capacity or incapacity documentation', 'Medical or professional documentation.', 'needed_now', 2);
  add(GRD, 'Medical and Capacity Information', 4, 'Medication list', 'Current prescriptions, dosage, and prescribing doctor.', 'if_available', 3);
  add(GRD, 'Medical and Capacity Information', 4, 'Insurance cards', 'Medicare, Medicaid, private insurance, VA, etc.', 'if_available', 4);
  add(GRD, 'Medical and Capacity Information', 4, 'Hospital or facility records', 'Admissions, discharge papers, care notes.', 'if_available', 5);

  add(GRD, 'Care Plan and Living Arrangement', 5, 'Current residence information', 'Address and type of residence.', 'needed_now', 1);
  add(GRD, 'Care Plan and Living Arrangement', 5, 'Care plan', 'Formal or informal plan.', 'if_available', 2);
  add(GRD, 'Care Plan and Living Arrangement', 5, 'Daily living needs summary', 'Bathing, dressing, meals, medication, mobility, supervision.', 'needed_now', 3);
  add(GRD, 'Care Plan and Living Arrangement', 5, 'Emergency contacts', 'People to contact in an emergency.', 'needed_now', 4);

  add(GRD, 'Family and Interested Parties', 6, 'Spouse and immediate family information', 'Names and contact information for key family members.', 'if_available', 1);
  add(GRD, 'Family and Interested Parties', 6, 'Interested parties required to receive notice', 'Determined by law firm / court requirements.', 'attorney_will_request', 2);
  add(GRD, 'Family and Interested Parties', 6, 'Family conflict or objection concerns', 'Describe any expected disputes.', 'attorney_will_request', 3);

  add(GRD, 'Benefits and Financial Overview', 7, 'Social Security benefits information', 'Helpful even for guardianship of the person.', 'if_available', 1);
  add(GRD, 'Benefits and Financial Overview', 7, 'Medicaid / Medicare information', 'Cards, coverage info, caseworker contact.', 'if_available', 2);
  add(GRD, 'Benefits and Financial Overview', 7, 'Representative payee information', 'Who manages benefits.', 'if_available', 3);

  add(GRD, 'Annual Guardian Report Readiness', 8, 'Current address and living arrangement update', 'Update at each reporting period.', 'needed_now', 1);
  add(GRD, 'Annual Guardian Report Readiness', 8, 'Current physical and mental condition update', 'General update.', 'needed_now', 2);
  add(GRD, 'Annual Guardian Report Readiness', 8, 'Medical treatment updates', 'Appointments, treatments, providers.', 'needed_now', 3);
  add(GRD, 'Annual Guardian Report Readiness', 8, 'Major changes since last report', 'Health, residence, care, family, incidents.', 'needed_now', 4);

  // ── JOINT GUARDIANSHIP & CONSERVATORSHIP ─────────────────────────────────
  const JNT = 'joint_guardianship_conservatorship';
  add(JNT, 'Court and Legal Documents', 1, 'Petition for guardianship and / or conservatorship', 'Filed or being prepared by attorney.', 'needed_now', 1);
  add(JNT, 'Court and Legal Documents', 1, 'Court order appointing guardian and / or conservator', 'Needed once court has entered an order.', 'if_available', 2);
  add(JNT, 'Court and Legal Documents', 1, 'Letters of guardianship and / or conservatorship', 'Confirms authority to act.', 'if_available', 3);
  add(JNT, 'Court and Legal Documents', 1, 'Temporary or emergency orders', 'Include if temporary authority exists.', 'if_available', 4);
  add(JNT, 'Court and Legal Documents', 1, 'Case number, court, county, judge, and docket', 'Helpful for existing matters.', 'if_available', 5);
  add(JNT, 'Court and Legal Documents', 1, 'Bond paperwork, oath, or training certificate', 'May be required by the court.', 'if_available', 6);

  add(JNT, 'Proposed Guardian / Conservator Information', 2, 'Full legal name, phone, email, and address', 'Identifies person seeking or serving in the role.', 'needed_now', 1);
  add(JNT, 'Proposed Guardian / Conservator Information', 2, 'Government-issued ID', 'Driver license, passport, or state ID.', 'needed_now', 2);
  add(JNT, 'Proposed Guardian / Conservator Information', 2, 'Relationship to protected person', 'Family, caregiver, professional, or other relationship.', 'needed_now', 3);
  add(JNT, 'Proposed Guardian / Conservator Information', 2, 'Emergency contact for guardian / conservator', 'Backup contact if firm cannot reach fiduciary.', 'if_available', 4);

  add(JNT, 'Protected Person Information', 3, 'Full legal name and date of birth', 'Identifies the person under court protection.', 'needed_now', 1);
  add(JNT, 'Protected Person Information', 3, 'Current address and living arrangement', 'Home, facility, hospital, assisted living, etc.', 'needed_now', 2);
  add(JNT, 'Protected Person Information', 3, 'Disability, incapacity, or diagnosis description', 'Plain-English summary acceptable at intake.', 'needed_now', 3);
  add(JNT, 'Protected Person Information', 3, 'Reason guardianship / conservatorship is requested', 'Explain why court involvement is needed.', 'needed_now', 4);
  add(JNT, 'Protected Person Information', 3, 'Safety, exploitation, or urgent risk concerns', 'Describe any immediate safety issues.', 'if_available', 5);

  add(JNT, 'Medical, Capacity, and Care Information', 4, 'Physician evaluation or capacity documentation', 'May be required or requested by court / attorney.', 'needed_now', 1);
  add(JNT, 'Medical, Capacity, and Care Information', 4, 'Medication list, pharmacy information, and treatment plan', 'Current prescriptions, dosage, prescribing doctor.', 'if_available', 2);
  add(JNT, 'Medical, Capacity, and Care Information', 4, 'Care plan or provider plan', 'Formal or informal plan.', 'if_available', 3);
  add(JNT, 'Medical, Capacity, and Care Information', 4, 'Insurance cards (health, Medicare, Medicaid, VA)', 'Documents coverage and benefits.', 'if_available', 4);

  add(JNT, 'Family and Interested Parties', 5, 'Spouse, adult children, parents, and siblings', 'Names, addresses, and contact information.', 'if_available', 1);
  add(JNT, 'Family and Interested Parties', 5, 'Any person objecting or seeking appointment', 'Attorney review needed for contested matters.', 'if_available', 2);
  add(JNT, 'Family and Interested Parties', 5, 'Emergency contacts for protected person', 'People to contact in an emergency.', 'needed_now', 3);

  add(JNT, 'Benefits, Income, and Support Resources', 6, 'Social Security, SSI, SSDI, VA, or public benefits statements', 'Documents recurring benefits and income.', 'if_available', 1);
  add(JNT, 'Benefits, Income, and Support Resources', 6, 'Medicaid, Medicare, or long-term-care benefit documents', 'Cards, coverage info, caseworker contact.', 'if_available', 2);
  add(JNT, 'Benefits, Income, and Support Resources', 6, 'Representative payee information', 'Who manages benefits currently.', 'if_available', 3);

  add(JNT, 'Assets and Property', 7, 'List of all known assets and estimated values', 'Foundation for initial inventory and future accountings.', 'needed_now', 1);
  add(JNT, 'Assets and Property', 7, 'Bank accounts and recent statements', 'Checking, savings, CDs, money market accounts.', 'needed_now', 2);
  add(JNT, 'Assets and Property', 7, 'Real estate deeds and property records', 'Homes, land, rental property.', 'if_available', 3);
  add(JNT, 'Assets and Property', 7, 'Retirement accounts, annuities, and investments', 'IRA, 401(k), pension, brokerage statements.', 'if_available', 4);
  add(JNT, 'Assets and Property', 7, 'Life insurance policies with cash value', 'Policy, beneficiary, and coverage details.', 'if_available', 5);
  add(JNT, 'Assets and Property', 7, 'Vehicle titles, registration, and estimated values', 'Cars, trucks, motorcycles, RVs, boats.', 'if_available', 6);

  add(JNT, 'Financial Records and Transaction History', 8, 'Recent bank statements for all known accounts', 'Establishes financial baseline.', 'needed_now', 1);
  add(JNT, 'Financial Records and Transaction History', 8, 'Receipts, invoices, and proof of payments', 'Supports expenses and reimbursement requests.', 'if_available', 2);
  add(JNT, 'Financial Records and Transaction History', 8, 'Records of suspected misuse, fraud, or missing funds', 'Helps identify exploitation or unauthorized activity.', 'attorney_will_request', 3);

  add(JNT, 'Debts and Liabilities', 9, 'Mortgage or home equity statements', 'Documents real estate debt.', 'if_available', 1);
  add(JNT, 'Debts and Liabilities', 9, 'Credit card and loan statements', 'Documents revolving and installment debt.', 'if_available', 2);
  add(JNT, 'Debts and Liabilities', 9, 'Tax notices, liens, or judgments', 'Documents legal and financial obligations.', 'if_available', 3);

  add(JNT, 'Annual Report and Accounting Readiness', 10, 'Annual guardian status / well-being report information', 'Current residence, condition, medical care, services.', 'needed_now', 1);
  add(JNT, 'Annual Report and Accounting Readiness', 10, 'Annual accounting: beginning balance, income, expenses, ending balance', 'Financial report for the full accounting period.', 'needed_now', 2);
  add(JNT, 'Annual Report and Accounting Readiness', 10, 'Updated inventory of assets and liabilities', 'Shows property still held and value changes.', 'needed_now', 3);
  add(JNT, 'Annual Report and Accounting Readiness', 10, 'Bank statements for entire reporting period', 'Supports balances and transactions.', 'needed_now', 4);

  return rows;
}