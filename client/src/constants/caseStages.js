// Workflow stage keys are fixed (they're the actual state machine used by the
// backend/attorney tooling) — only the client-facing wording changes per
// matter type, since "Guardian Appointed" is wrong to show on a
// conservatorship-only case (no guardian is ever appointed in one).
export const STAGE_KEYS = [
  'intake', 'petition_filed', 'hearing_prep',
  'guardian_appointed', 'care_plan', 'annual_review', 'court_review',
];

const STAGE_CONFIG = {
  guardianship: {
    labels: ['Intake', 'Petition Filed', 'Hearing Prep', 'Guardian Appointed', 'Care Plan', 'Annual Review', 'Court Review'],
    stories: {
      intake:             'Your matter has been opened and intake is underway. Your legal team is reviewing your information.',
      petition_filed:     'Your petition has been filed with the court. The team is preparing for the next steps.',
      hearing_prep:       'Your legal team is preparing for the upcoming hearing. Please ensure all documents are uploaded.',
      guardian_appointed: 'A guardian has been appointed by the court. The formal care plan is now in effect.',
      care_plan:          'The care plan is active. Your team is monitoring progress and upcoming reporting deadlines.',
      annual_review:      'An annual review is underway. Your legal team is preparing the required reports.',
      court_review:       'Your case is under court review. Your attorney will update you following the hearing.',
    },
  },
  conservatorship: {
    labels: ['Intake', 'Petition Filed', 'Hearing Prep', 'Conservator Appointed', 'Financial Plan', 'Annual Accounting', 'Court Review'],
    stories: {
      intake:             'Your matter has been opened and intake is underway. Your legal team is reviewing your information.',
      petition_filed:     'Your petition has been filed with the court. The team is preparing for the next steps.',
      hearing_prep:       'Your legal team is preparing for the upcoming hearing. Please ensure all documents are uploaded.',
      guardian_appointed: 'A conservator has been appointed by the court. The financial management plan is now in effect.',
      care_plan:          'The financial plan is active. Your team is monitoring the estate and upcoming reporting deadlines.',
      annual_review:      'The annual accounting is underway. Your legal team is preparing the required financial reports.',
      court_review:       'Your case is under court review. Your attorney will update you following the hearing.',
    },
  },
  guardianship_conservatorship: {
    labels: ['Intake', 'Petition Filed', 'Hearing Prep', 'Guardian & Conservator Appointed', 'Care & Financial Plan', 'Annual Review', 'Court Review'],
    stories: {
      intake:             'Your matter has been opened and intake is underway. Your legal team is reviewing your information.',
      petition_filed:     'Your petition has been filed with the court. The team is preparing for the next steps.',
      hearing_prep:       'Your legal team is preparing for the upcoming hearing. Please ensure all documents are uploaded.',
      guardian_appointed: 'A guardian and conservator have been appointed by the court. The formal care and financial plan is now in effect.',
      care_plan:          'The care and financial plan is active. Your team is monitoring progress and upcoming reporting deadlines.',
      annual_review:      'An annual review is underway. Your legal team is preparing the required reports.',
      court_review:       'Your case is under court review. Your attorney will update you following the hearing.',
    },
  },
  estate_administration: {
    labels: ['Intake', 'Petition Filed', 'Hearing Prep', 'Executor Appointed', 'Estate Plan', 'Annual Accounting', 'Court Review'],
    stories: {
      intake:             'Your matter has been opened and intake is underway. Your legal team is reviewing your information.',
      petition_filed:     'Your petition for probate has been filed with the court. The team is preparing for the next steps.',
      hearing_prep:       'Your legal team is preparing for the upcoming hearing. Please ensure all documents are uploaded.',
      guardian_appointed: 'An executor has been appointed by the court. Estate administration is now underway.',
      care_plan:          'The estate plan is active. Your team is managing assets and upcoming reporting deadlines.',
      annual_review:      'The annual accounting is underway. Your legal team is preparing the required reports.',
      court_review:       'Your case is under court review. Your attorney will update you following the hearing.',
    },
  },
};

export function getStageLabels(matterType) {
  return (STAGE_CONFIG[matterType] || STAGE_CONFIG.guardianship).labels;
}

export function getStageStory(matterType, stageKey) {
  const cfg = STAGE_CONFIG[matterType] || STAGE_CONFIG.guardianship;
  return cfg.stories[stageKey] || 'Your matter is underway.';
}
