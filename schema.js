const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

module.exports = {
  Account: {
    fields: {
      email: type.string().email(),
      password: type.string(),
      passwordSalt: type.string(),
      stripeCustomerId: type.string().optional(),
      paymentSetup: type.boolean().default(false),
      nationalCurrency: type.string().default('USD'),
      emailVerified: type.boolean().default(false),
      emailVerificationKey: type.string().optional(),
      emailVerificationExpiry: type.date().optional(),
      passwordResetKey: type.string().optional(),
      passwordResetExpiry: type.date().optional(),
      active: type.boolean().default(true),
      created: type.date()
    },
    filters: {
      pre: accountPrefilter
    }
  },
  ActivityLog: {
    fields: {
      type: type.string(),
      action: type.string().optional(),
      data: type.object().optional(),
      created: type.date()
    }
  },
  MailLog: {
    fields: {
      data: type.object(),
      created: type.date()
    }
  }
};

async function accountPrefilter(req, next) {
  if (req.action == 'create') {
    return;
  }
  if (!req.authToken || !req.query || !req.authToken.userId || req.authToken.userId != req.query.id) {
    throw new Error('A user can only access their own account');
  }
}
