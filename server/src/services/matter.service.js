const MatterRepo = require('../repositories/matter.repository');
const UserRepo   = require('../repositories/user.repository');
const { MATTER_STAGES, buildCaseNumber } = require('../domain/matter');
const { NotFoundError, ForbiddenError, ValidationError } = require('../lib/errors');
const { isClient } = require('../domain/user');

const MatterService = {
  async list(user, pagination) {
    if (isClient(user.role)) {
      return MatterRepo.findByClientId(user.id, pagination);
    }
    return MatterRepo.findAll(pagination);
  },

  async getById(id, user) {
    const matter = await MatterRepo.findById(id);
    if (!matter) throw new NotFoundError('Matter');
    if (isClient(user.role) && matter.client_id !== user.id)
      throw new ForbiddenError();
    return matter;
  },

  async create(body, userId) {
    const { description, court, county, state, urgent, importantDate,
            hasDocuments, workedWithFirmBefore, additionalNotes, matterStatus } = body;
    // Accept both camelCase (intake wizard / register flow) and snake_case (direct API calls)
    const matterType = body.matterType || body.matter_type || null;

    const r = await MatterRepo.create({
      clientId: userId,
      matterType, description, court, county, state, urgent,
      importantDate, hasDocuments, workedWithFirmBefore,
      additionalNotes, status: matterStatus,
    });

    const client = await UserRepo.findById(userId);
    await MatterRepo.setCaseNumber(r.insertId, buildCaseNumber({
      id: r.insertId, firstName: client?.first_name, lastName: client?.last_name, createdAt: client?.created_at,
    }));
    return MatterRepo.findById(r.insertId);
  },

  async update(id, body) {
    const { attorney_id } = body;

    if (attorney_id !== undefined && attorney_id !== null) {
      const atty = await MatterRepo.findAttorneyById(attorney_id);
      if (!atty)
        throw new ValidationError('Attorney not found');
      if (!atty.email_verified)
        throw new ValidationError('This attorney has not verified their email address yet');
      if (atty.approval_status !== null && atty.approval_status !== 'approved')
        throw new ValidationError('This attorney account is pending approval and cannot be assigned');
    }

    const fields = {};
    if (attorney_id !== undefined)          fields.attorney_id      = attorney_id;
    if (body.stage !== undefined)           fields.stage            = body.stage;
    if (body.status !== undefined)          fields.status           = body.status;
    if (body.description !== undefined)     fields.description      = body.description;
    if (body.court !== undefined)           fields.court            = body.court;
    if (body.county !== undefined)          fields.county           = body.county;
    if (body.state !== undefined)           fields.state            = body.state;
    if (body.urgent !== undefined)          fields.urgent           = body.urgent ? 1 : 0;
    if (body.importantDate !== undefined)   fields.important_date   = body.importantDate;
    if (body.additionalNotes !== undefined) fields.additional_notes = body.additionalNotes;
    // Accept both snake_case (API/frontend) and camelCase for matter type updates
    const newType = body.matter_type ?? body.matterType;
    if (newType !== undefined)              fields.matter_type      = newType;

    await MatterRepo.update(id, fields);
  },

  async timeline(id, user) {
    const m = await MatterRepo.findStageAndClient(id);
    if (!m) throw new NotFoundError('Matter');
    if (isClient(user.role) && m.client_id !== user.id)
      throw new ForbiddenError();

    const cur = MATTER_STAGES.indexOf(m.stage);
    return MATTER_STAGES.map((stage, i) => ({
      stage,
      completed: i < cur,
      current:   i === cur,
      upcoming:  i > cur,
    }));
  },
};

module.exports = MatterService;