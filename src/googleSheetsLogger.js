const SUCCESS_STATUSES = new Set(['appended', 'duplicate']);

function parseBoolean(value) {
  return String(value || '').toLowerCase() === 'true';
}

function getKoreanDateString(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function getConfig(env = process.env) {
  return {
    enabled: parseBoolean(env.GOOGLE_SHEETS_LOGGING_ENABLED),
    url: env.GOOGLE_SHEETS_WEB_APP_URL || '',
    secret: env.GOOGLE_SHEETS_WEB_APP_SECRET || '',
  };
}

function getAttachmentUrls(submission) {
  if (Array.isArray(submission.attachmentUrls)) {
    return submission.attachmentUrls.filter(Boolean);
  }

  if (submission.attachment && submission.attachment.url) {
    return [submission.attachment.url];
  }

  return [];
}

function getAttachmentCount(submission) {
  if (Number.isInteger(submission.attachmentCount)) {
    return submission.attachmentCount;
  }

  return getAttachmentUrls(submission).length;
}

function getSourceSurfaceForTransaction(transaction, context = {}) {
  if (context.sourceSurface) {
    return context.sourceSurface;
  }

  const relatedType = transaction.relatedType || '';
  if (relatedType === 'missionReactionApproval') return 'reaction_approval';
  if (relatedType === 'todayMissionSubmission') return 'today_mission_channel';
  if (relatedType === 'checkin') return 'slash_command';
  if (relatedType === 'redemption') return 'slash_command';
  if (relatedType === 'manual') return 'operator_command';
  return 'slash_command';
}

function getSourceSurfaceForSubmission(submission, context = {}) {
  if (context.sourceSurface) {
    return context.sourceSurface;
  }

  return submission.type === 'todayMission' ? 'today_mission_channel' : 'slash_command';
}

function buildPointTransactionRecord(transaction, context = {}) {
  return {
    event_id: `point_transaction:${transaction.id}`,
    transaction_id: transaction.id,
    created_at: transaction.createdAt || '',
    created_date_kst: getKoreanDateString(transaction.createdAt),
    user_id: transaction.userId,
    display_name: (context.user && context.user.displayName) || context.displayName || transaction.displayName || '',
    type: transaction.type,
    amount: transaction.amount,
    balance_after: transaction.balanceAfter,
    reason: transaction.reason || '',
    related_type: transaction.relatedType || '',
    related_id: transaction.relatedId || '',
    created_by: transaction.createdBy || '',
    source_surface: getSourceSurfaceForTransaction(transaction, context),
    discord_message_url: context.discordMessageUrl || transaction.discordMessageUrl || '',
    note: transaction.note || '',
    appended_at: '',
  };
}

function buildMissionSubmissionRecord(submission, context = {}) {
  const attachmentUrls = getAttachmentUrls(submission);
  const todayMissionDate = submission.todayMissionDate || '';
  const mission = context.mission || {};

  return {
    event_id: `mission_submissions:${submission.id}`,
    submission_id: submission.id,
    submitted_at: submission.createdAt || '',
    submitted_date_kst: getKoreanDateString(submission.createdAt),
    type: submission.type || '',
    mission_id: submission.missionId || '',
    mission_title: submission.missionTitle || mission.title || '',
    today_mission_date: todayMissionDate,
    user_id: submission.userId,
    display_name: submission.displayName || '',
    content_summary: submission.contentSummary || String(submission.content || '').trim().slice(0, 500),
    attachment_count: getAttachmentCount(submission),
    attachment_urls: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : '',
    message_id: submission.messageId || '',
    channel_id: submission.channelId || '',
    guild_id: submission.guildId || '',
    discord_message_url: submission.messageUrl || context.discordMessageUrl || '',
    status_at_submit: submission.status || '',
    reward_points: typeof submission.rewardPoints === 'number'
      ? submission.rewardPoints
      : mission.rewardPoints || '',
    duplicate_key: submission.type === 'todayMission' && todayMissionDate
      ? `todayMission:${todayMissionDate}:${submission.userId}`
      : '',
    source_surface: getSourceSurfaceForSubmission(submission, context),
    appended_at: '',
  };
}

function buildPointTransactionPayload(transaction, context = {}) {
  return {
    tab: 'point_transactions',
    payload: buildPointTransactionRecord(transaction, context),
  };
}

function buildMissionSubmissionPayload(submission, context = {}) {
  return {
    tab: 'mission_submissions',
    payload: buildMissionSubmissionRecord(submission, context),
  };
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Google Sheets append returned invalid JSON: ${error.message}`);
  }
}

function toSkipped(reason) {
  return { ok: false, skipped: true, reason };
}

function toFailed(error) {
  return { ok: false, skipped: false, reason: 'REQUEST_FAILED', error };
}

async function appendRecord(tab, payloadRecord, options = {}) {
  const config = options.config || getConfig(options.env || process.env);

  if (!config.enabled) {
    return toSkipped('DISABLED');
  }

  if (!config.url || !config.secret) {
    return toSkipped('MISSING_CONFIG');
  }

  const fetchImpl = options.fetch || global.fetch;
  if (typeof fetchImpl !== 'function') {
    return toSkipped('FETCH_UNAVAILABLE');
  }

  const payload = {
    secret: config.secret,
    tab,
    payload: payloadRecord,
  };

  try {
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google Sheets append failed with HTTP ${response.status || 'unknown'}`);
    }

    const responseBody = await readJsonResponse(response);
    if (!SUCCESS_STATUSES.has(responseBody.status)) {
      throw new Error(`Google Sheets append returned status ${responseBody.status || 'unknown'}`);
    }

    return {
      ok: true,
      skipped: false,
      status: responseBody.status,
      response: responseBody,
    };
  } catch (error) {
    const warn = options.warn || console.warn;
    warn('Google Sheets append failed:', error.message);
    return toFailed(error);
  }
}

function appendPointTransaction(transaction, context = {}) {
  const payload = buildPointTransactionPayload(transaction, context);
  return appendRecord(payload.tab, payload.payload, context);
}

function appendMissionSubmission(submission, context = {}) {
  const payload = buildMissionSubmissionPayload(submission, context);
  return appendRecord(payload.tab, payload.payload, context);
}

function appendGoogleSheetsLog(tab, payload, options = {}) {
  return appendRecord(tab, payload, options);
}

function logPointTransaction(transaction, context = {}) {
  return appendPointTransaction(transaction, context);
}

function logMissionSubmission(submission, mission = null, context = {}) {
  return appendMissionSubmission(submission, { ...context, mission });
}

module.exports = {
  appendGoogleSheetsLog,
  appendMissionSubmission,
  appendPointTransaction,
  appendRecord,
  buildMissionSubmissionRecord,
  buildMissionSubmissionPayload,
  buildPointTransactionRecord,
  buildPointTransactionPayload,
  getConfig,
  getKoreanDateString,
  logMissionSubmission,
  logPointTransaction,
};
