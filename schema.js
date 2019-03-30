const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

module.exports = {
  User: {
    fields: {
      email: type.string().email(),
      gitHubAccount: type.string().optional(),
      password: type.string(),
      passwordSalt: type.string(),
      plan: type.string(),
      planPrice: type.number().integer(),
      planMessageLimit: type.number().integer(),
      planQuotaLimitIsHard: type.boolean(),
      planMessageSurchargeCost: type.number().integer(),
      planStartDate: type.date(),
      planDowngradeDate: type.date().default(null),
      stripeCustomerId: type.string().optional(),
      paymentSetup: type.boolean().default(false),
      planPaidUntilDate: type.date().default(null),
      trialExpiry: type.date().default(null),
      currency: type.string().default('USD'),
      serviceKey: type.string(),
      emailVerified: type.boolean().default(false),
      emailVerificationKey: type.string().optional(),
      emailVerificationExpiry: type.date().optional(),
      passwordResetKey: type.string().optional(),
      passwordResetExpiry: type.date().optional(),
      zone: type.string(),
      rancherProject: type.string().optional(),
      active: type.boolean().default(true),
      created: type.date()
    },
    filters: {
      pre: userPrefilter
    }
  },
  UsageMinuteLog: {
    fields: {
      serviceKey: type.string(),
      // This will be rounded down to the closest whole minute.
      time: type.date(),
      // Inbound message count.
      in: type.number().default(0),
      // Outbound message count.
      out: type.number().default(0)
    }
  },
  UsageMonthLog: {
    fields: {
      serviceKey: type.string(),
      // This will be rounded down to the closest whole month.
      time: type.date(),
      // Inbound message count.
      in: type.number().default(0),
      // Outbound message count.
      out: type.number().default(0)
    },
    views: {
      currentMonthUsage: {
        paramFields: ['serviceKey'],
        affectingFields: ['serviceKeyTime'],
        transform: function (fullTableQuery, r, usageMonthLogFields) {
          let nearestWholeMonth = r.time(r.now().year(), r.now().month(), 1, 0, 0, 0, 'Z');
          return fullTableQuery.getAll([usageMonthLogFields.serviceKey, nearestWholeMonth], {index: 'serviceKeyTime'});
        }
      }
    },
    filters: {
      pre: usageMonthLogPrefilter
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
  },
  Invoice: {
    fields: {
      // Will be null if not paid.
      userId: type.string(),
      // The month covered by an invoice.
      monthStartDate: type.date(),
      items: type.array(),
      totalCost: type.number(),
      paidOnDate: type.date().default(null),
      created: type.date()
    }
  }
};

function alwaysAllow(req, next) {
  next();
}

function userPrefilter(req, next) {
  if (req.action == 'create') {
    next();
  } else {
    next(!req.authToken || !req.query || !req.authToken.userId || req.authToken.userId != req.query.id);
  }
}

function usageMonthLogPrefilter(req, next) {
  if (req.query && req.query.view && req.authToken && req.authToken.serviceKey && req.query.viewParams
  && req.authToken.serviceKey == req.query.viewParams.serviceKey) {
    next();
    return;
  }
  if (!req.query || !req.authToken || !req.query.id) {
    next(true);
    return;
  }
  if (req.socket.currentUsageMonthLog && req.query.id == req.socket.currentUsageMonthLog) {
    next();
    return;
  }
  req.r.table(req.query.type).get(req.query.id).run(function (err, result) {
    if (err) {
      next(true);
    } else {
      let isAllowed = req.authToken.serviceKey && req.authToken.serviceKey == result.serviceKey;
      if (isAllowed) {
        req.socket.currentUsageMonthLog = req.query.id;
        next();
      } else {
        next(true);
      }
    }
  });
}
