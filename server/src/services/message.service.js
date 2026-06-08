const MessageRepo = require('../repositories/message.repository');
const UserRepo    = require('../repositories/user.repository');
const { emitToUser } = require('../websocket');
const { NotFoundError, ForbiddenError } = require('../lib/errors');
const NotificationService = require('./notification.service');
const AuditService        = require('./audit.service');

const MessageService = {
  inbox(userId) {
    return MessageRepo.findByRecipient(userId);
  },

  sent(userId) {
    return MessageRepo.findBySender(userId);
  },

  unreadCount(userId) {
    return MessageRepo.unreadCount(userId);
  },

  async send({ fromUser, toUserId, matterId, subject, body }) {
    const recipient = await UserRepo.findById(toUserId);
    if (!recipient) throw new NotFoundError('Recipient');

    // H6: clients may only message firm staff — prevents enumeration and
    // unsolicited contact between clients who should not know each other exist.
    const { isStaff } = require('../domain/user');
    if (fromUser.role === 'client' && !isStaff(recipient.role))
      throw new ForbiddenError('Clients can only message firm staff');

    const msg = await MessageRepo.create({
      matterId, fromUserId: fromUser.id, toUserId, subject, body,
    });

    const fromName = `${fromUser.first_name} ${fromUser.last_name}`;

    // Real-time delivery to the messages panel
    emitToUser(toUserId, 'message:new', {
      id:         msg.id,
      from_name:  fromName,
      subject:    msg.subject,
      preview:    body.slice(0, 120),
      created_at: msg.created_at,
    });

    // Notification bell + secondary delivery
    NotificationService.newMessage(toUserId, { fromName, subject, messageId: msg.id });

    // Async audit — fire and forget
    AuditService.log({ userId: fromUser.id, action: AuditService.ACTIONS.MESSAGE_SENT, entity: 'message', entityId: msg.id });

    return msg;
  },

  async markRead(messageId, userId) {
    const msg = await MessageRepo.findOwnedById(messageId, userId);
    if (!msg) throw new NotFoundError('Message');
    await MessageRepo.markRead(messageId);
  },
};

module.exports = MessageService;