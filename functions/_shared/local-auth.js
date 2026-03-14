const PASSWORD_ITERATIONS = 100000
const USERNAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,23}$/
const REGISTRATION_MODES = new Set(['public', 'invite_only', 'disabled'])
const LOCAL_AUTH_SETTINGS_ROW_ID = 1
const DEFAULT_USER_LIST_LIMIT = 200
const DEFAULT_INVITE_LIST_LIMIT = 200
const GENERATED_INVITE_PREFIX = 'AS'

let schemaReadyPromise = null

export function hasLocalAuthDatabase(env) {
  return Boolean(env.AUTH_DB)
}

export async function getLocalAuthClientConfig(env) {
  const config = await resolveLocalAuthConfig(env)

  return {
    enabled: config.enabled,
    registrationMode: config.registrationMode,
    registrationEnabled: config.registrationEnabled,
    registrationStatus: config.registrationStatus,
    inviteCodeRequired: config.inviteCodeRequired,
    registrationLimit: config.registrationLimit,
    totalUsers: config.totalUsers,
    remainingSlots: config.remainingSlots
  }
}

export async function getLocalAuthAdminSnapshot(env) {
  const config = await resolveLocalAuthConfig(env)

  if (!config.enabled) {
    return {
      available: false,
      settings: buildSettingsPayload(config),
      stats: buildStatsPayload(config, null),
      invites: [],
      users: []
    }
  }

  await ensureLocalAuthSchema(env.AUTH_DB)

  const [statsRecord, users, invites] = await Promise.all([
    fetchLocalAuthStats(env.AUTH_DB, config),
    listLocalUsers(env.AUTH_DB),
    listLocalAuthInvites(env.AUTH_DB, config)
  ])

  return {
    available: true,
    settings: buildSettingsPayload(config),
    stats: buildStatsPayload(config, statsRecord),
    invites,
    users
  }
}

export async function updateLocalAuthAdminSettings(db, payload, actor = '') {
  if (!db) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  await ensureLocalAuthSchema(db)

  const currentSettings = await readRuntimeLocalAuthSettings(db)
  const registrationMode = normalizeRegistrationMode(payload?.registrationMode)
  const registrationLimit = normalizeRegistrationLimit(payload?.registrationLimit)
  const shouldUpdateLegacyInvites =
    Object.prototype.hasOwnProperty.call(payload || {}, 'inviteCodesText') ||
    Object.prototype.hasOwnProperty.call(payload || {}, 'inviteCodes')
  const inviteCodes = shouldUpdateLegacyInvites
    ? parseInviteCodes(payload?.inviteCodesText || payload?.inviteCodes)
    : currentSettings?.inviteCodes || []
  const now = new Date().toISOString()

  await db
    .prepare(
      `INSERT INTO local_auth_settings (
        id,
        registration_mode,
        registration_limit,
        invite_codes,
        updated_at,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        registration_mode = excluded.registration_mode,
        registration_limit = excluded.registration_limit,
        invite_codes = excluded.invite_codes,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by`
    )
    .bind(
      LOCAL_AUTH_SETTINGS_ROW_ID,
      registrationMode,
      registrationLimit,
      inviteCodes.join('\n'),
      now,
      String(actor || '').trim()
    )
    .run()
}

export async function updateLocalUserEnabled(db, userId, isEnabled, actorSessionUser = null) {
  if (!db) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  await ensureLocalAuthSchema(db)

  const numericUserId = normalizeLocalUserId(userId)
  if (!numericUserId) {
    throw new LocalAuthError('invalid_user', '目标用户不存在。', 400)
  }

  if (!isEnabled && String(actorSessionUser?.id || '') === `local:${numericUserId}`) {
    throw new LocalAuthError('cannot_disable_current_user', '不能停用当前正在使用的管理员账号。', 400)
  }

  const existing = await findLocalUserRecordById(db, numericUserId)
  if (!existing) {
    throw new LocalAuthError('user_not_found', '目标用户不存在。', 404)
  }

  await db
    .prepare('UPDATE local_users SET is_enabled = ? WHERE id = ?')
    .bind(isEnabled ? 1 : 0, numericUserId)
    .run()
}

export async function deleteLocalUser(db, userId, actorSessionUser = null) {
  if (!db) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  await ensureLocalAuthSchema(db)

  const numericUserId = normalizeLocalUserId(userId)
  if (!numericUserId) {
    throw new LocalAuthError('invalid_user', '目标用户不存在。', 400)
  }

  if (String(actorSessionUser?.id || '') === `local:${numericUserId}`) {
    throw new LocalAuthError('cannot_delete_current_user', '不能删除当前正在使用的管理员账号。', 400)
  }

  const existing = await findLocalUserRecordById(db, numericUserId)
  if (!existing) {
    throw new LocalAuthError('user_not_found', '目标用户不存在。', 404)
  }

  await db
    .prepare('DELETE FROM local_users WHERE id = ?')
    .bind(numericUserId)
    .run()
}

export async function createLocalAuthInvite(db, payload, actor = '') {
  if (!db) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  await ensureLocalAuthSchema(db)

  const label = normalizeInviteLabel(payload?.label)
  const maxUses = normalizeInviteUsageLimit(payload?.maxUses)
  const now = new Date().toISOString()

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode()

    try {
      const result = await db
        .prepare(
          `INSERT INTO local_auth_invites (
            code,
            code_normalized,
            label,
            max_uses,
            used_count,
            is_enabled,
            created_at,
            updated_at,
            last_used_at,
            created_by
          ) VALUES (?, ?, ?, ?, 0, 1, ?, ?, NULL, ?)`
        )
        .bind(code, normalizeInviteCode(code), label, maxUses, now, now, String(actor || '').trim())
        .run()

      const created = await findLocalAuthInviteById(db, result.meta?.last_row_id)
      if (created) return created
    } catch (error) {
      if (!String(error?.message || '').toLowerCase().includes('unique')) {
        throw error
      }
    }
  }

  throw new LocalAuthError('invite_generate_failed', '邀请码生成失败，请稍后再试。', 500)
}

export async function updateLocalAuthInvite(db, payload) {
  if (!db) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  await ensureLocalAuthSchema(db)

  const inviteId = normalizeInviteId(payload?.inviteId)
  if (!inviteId) {
    throw new LocalAuthError('invalid_invite', '目标邀请码不存在。', 400)
  }

  const invite = await findLocalAuthInviteById(db, inviteId)
  if (!invite) {
    throw new LocalAuthError('invite_not_found', '目标邀请码不存在。', 404)
  }

  const updates = []
  const bindings = []

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'isEnabled')) {
    updates.push('is_enabled = ?')
    bindings.push(payload.isEnabled ? 1 : 0)
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'maxUses')) {
    const maxUses = normalizeInviteUsageLimit(payload?.maxUses)
    if (maxUses !== null && maxUses < invite.usedCount) {
      throw new LocalAuthError('invite_limit_too_small', '新的可用次数不能小于当前已使用次数。', 400)
    }

    updates.push('max_uses = ?')
    bindings.push(maxUses)
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, 'label')) {
    updates.push('label = ?')
    bindings.push(normalizeInviteLabel(payload?.label))
  }

  if (!updates.length) {
    return invite
  }

  updates.push('updated_at = ?')
  bindings.push(new Date().toISOString(), inviteId)

  await db
    .prepare(`UPDATE local_auth_invites SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run()

  return findLocalAuthInviteById(db, inviteId)
}

export async function assertLocalRegistrationAllowed(env, inviteCode = '') {
  const config = await resolveLocalAuthConfig(env)

  if (!config.enabled) {
    throw new LocalAuthError('local_auth_unavailable', '当前环境还没有启用内测账号数据库。', 503)
  }

  if (config.registrationStatus === 'closed') {
    throw new LocalAuthError('registration_disabled', '当前环境已关闭公开注册，只保留已有账号登录。', 403)
  }

  if (config.registrationStatus === 'invite_codes_missing') {
    throw new LocalAuthError('registration_unavailable', '当前环境尚未配置可用的邀请码，请稍后再试。', 503)
  }

  if (config.registrationStatus === 'invite_codes_exhausted') {
    throw new LocalAuthError('invite_code_exhausted', '当前邀请码已全部用完，请等待管理员补充邀请码。', 403)
  }

  if (config.registrationStatus === 'limit_reached') {
    throw new LocalAuthError('registration_limit_reached', '当前注册名额已满，请等待管理员放开名额。', 403)
  }

  let matchedInviteId = null

  if (config.inviteCodeRequired) {
    const normalizedInviteCode = normalizeInviteCode(inviteCode)
    if (!normalizedInviteCode) {
      throw new LocalAuthError('invite_code_required', '当前注册需要邀请码，请先填写邀请码。', 400)
    }

    if (config.inviteSource === 'managed') {
      const matched = config.managedInvites.find(
        (candidate) => candidate.codeNormalized === normalizedInviteCode
      )

      if (!matched) {
        const disabledOrExhausted = config.allManagedInvites.find(
          (candidate) => candidate.codeNormalized === normalizedInviteCode
        )

        if (disabledOrExhausted && disabledOrExhausted.remainingUses === 0) {
          throw new LocalAuthError('invite_code_exhausted', '这个邀请码已经用完了，请更换邀请码。', 403)
        }

        throw new LocalAuthError('invalid_invite_code', '邀请码无效或已停用，请检查后重试。', 403)
      }

      matchedInviteId = matched.id
    } else {
      const matched = config.inviteCodes.some((candidate) => candidate === normalizedInviteCode)
      if (!matched) {
        throw new LocalAuthError('invalid_invite_code', '邀请码无效或已停用，请检查后重试。', 403)
      }
    }
  }

  return {
    ...config,
    matchedInviteId
  }
}

export async function reserveInviteUse(db, inviteId) {
  if (!inviteId) return

  const now = new Date().toISOString()
  const result = await db
    .prepare(
      `UPDATE local_auth_invites
      SET
        used_count = used_count + 1,
        last_used_at = ?,
        updated_at = ?
      WHERE
        id = ?
        AND is_enabled = 1
        AND (max_uses IS NULL OR used_count < max_uses)`
    )
    .bind(now, now, inviteId)
    .run()

  if (!result.meta?.changes) {
    throw new LocalAuthError('invite_code_exhausted', '这个邀请码已经用完了，请更换邀请码。', 403)
  }
}

export async function releaseInviteUse(db, inviteId) {
  if (!inviteId) return

  await db
    .prepare(
      `UPDATE local_auth_invites
      SET
        used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END,
        updated_at = ?
      WHERE id = ?`
    )
    .bind(new Date().toISOString(), inviteId)
    .run()
}

export function validateRegistrationInput(payload, options = {}) {
  const input = normalizeAuthInput(payload)

  if (!USERNAME_PATTERN.test(input.username)) {
    return {
      ok: false,
      error: 'invalid_username',
      message: '用户名需为 3-24 位，只能包含字母、数字、下划线和短横线。'
    }
  }

  if (input.password.length < 8 || input.password.length > 128) {
    return {
      ok: false,
      error: 'invalid_password',
      message: '密码长度需要在 8 到 128 位之间。'
    }
  }

  if (options.inviteCodeRequired && !input.inviteCode) {
    return {
      ok: false,
      error: 'invite_code_required',
      message: '当前注册需要邀请码，请先填写邀请码。'
    }
  }

  return {
    ok: true,
    value: input
  }
}

export function validateLoginInput(payload) {
  const input = normalizeAuthInput(payload)

  if (!input.username || !input.password) {
    return {
      ok: false,
      error: 'missing_credentials',
      message: '请输入用户名和密码。'
    }
  }

  return {
    ok: true,
    value: input
  }
}

export async function createLocalUser(db, payload) {
  await ensureLocalAuthSchema(db)

  const now = new Date().toISOString()
  const passwordSalt = randomHex(16)
  const passwordHash = await derivePasswordHash(payload.password, passwordSalt, PASSWORD_ITERATIONS)

  try {
    const result = await db
      .prepare(
        `INSERT INTO local_users (
          username,
          username_normalized,
          display_name,
          password_hash,
          password_salt,
          password_iterations,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        payload.username,
        payload.usernameNormalized,
        payload.displayName,
        passwordHash,
        passwordSalt,
        PASSWORD_ITERATIONS,
        now
      )
      .run()

    return findLocalUserById(db, result.meta?.last_row_id)
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      throw new LocalAuthError('username_taken', '这个用户名已经被注册了。', 409)
    }

    throw error
  }
}

export async function authenticateLocalUser(db, username, password) {
  await ensureLocalAuthSchema(db)

  const user = await findLocalUserByNormalizedUsername(db, normalizeUsername(username))
  if (!user) {
    return {
      ok: false,
      error: 'invalid_credentials'
    }
  }

  if (!user.is_enabled) {
    return {
      ok: false,
      error: 'account_disabled'
    }
  }

  const derived = await derivePasswordHash(password, user.password_salt, user.password_iterations)
  if (!constantTimeEqual(derived, user.password_hash)) {
    return {
      ok: false,
      error: 'invalid_credentials'
    }
  }

  await db
    .prepare('UPDATE local_users SET last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), user.id)
    .run()

  return {
    ok: true,
    user: mapLocalUser(user)
  }
}

export async function findLocalUserById(db, id) {
  await ensureLocalAuthSchema(db)

  const record = await findLocalUserRecordById(db, normalizeLocalUserId(id))
  return record ? mapLocalUser(record) : null
}

export function mapLocalUser(record) {
  return {
    id: `local:${record.id}`,
    username: record.username,
    name: record.display_name || record.username,
    avatar: '',
    trustLevel: null,
    provider: 'local'
  }
}

export class LocalAuthError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function resolveLocalAuthConfig(env) {
  const enabled = hasLocalAuthDatabase(env)
  const envConfig = {
    enabled,
    registrationMode: normalizeRegistrationMode(env?.LOCAL_AUTH_REGISTRATION_MODE),
    staticInviteCodes: parseInviteCodes(env?.LOCAL_AUTH_INVITE_CODES),
    registrationLimit: normalizeRegistrationLimit(env?.LOCAL_AUTH_REGISTRATION_LIMIT),
    source: 'environment'
  }

  if (!enabled) {
    return finalizeLocalAuthConfig({
      ...envConfig,
      inviteSource: 'none',
      inviteCodes: [],
      managedInvites: [],
      allManagedInvites: [],
      totalUsers: 0
    })
  }

  await ensureLocalAuthSchema(env.AUTH_DB)

  const [runtimeSettings, totalUsers, runtimeInvites] = await Promise.all([
    readRuntimeLocalAuthSettings(env.AUTH_DB),
    countLocalUsers(env.AUTH_DB),
    readRuntimeLocalAuthInvites(env.AUTH_DB)
  ])

  const managedInvites = runtimeInvites.filter((invite) => canManagedInviteBeUsed(invite))
  const settingsInviteCodes = runtimeSettings?.inviteCodes || []

  let inviteSource = 'none'
  let inviteCodes = []

  if (runtimeInvites.length) {
    inviteSource = 'managed'
    inviteCodes = managedInvites.map((invite) => invite.codeNormalized)
  } else if (settingsInviteCodes.length) {
    inviteSource = 'runtime'
    inviteCodes = settingsInviteCodes
  } else if (envConfig.staticInviteCodes.length) {
    inviteSource = 'environment'
    inviteCodes = envConfig.staticInviteCodes
  }

  const config = runtimeSettings
    ? {
        enabled,
        registrationMode: runtimeSettings.registrationMode,
        staticInviteCodes: settingsInviteCodes,
        registrationLimit: runtimeSettings.registrationLimit,
        source: 'runtime'
      }
    : envConfig

  return finalizeLocalAuthConfig({
    ...config,
    inviteSource,
    inviteCodes,
    managedInvites,
    allManagedInvites: runtimeInvites,
    totalUsers
  })
}

function finalizeLocalAuthConfig(config) {
  const inviteCodeRequired = config.registrationMode === 'invite_only'
  const totalUsers = Number(config.totalUsers || 0)
  const registrationLimit =
    config.registrationLimit === null || config.registrationLimit === undefined
      ? null
      : Number(config.registrationLimit)
  const remainingSlots =
    registrationLimit === null ? null : Math.max(registrationLimit - totalUsers, 0)
  const inviteCodeCount = countUsableInviteCodes(config)
  const totalInviteCount = countTotalInviteCodes(config)

  let registrationStatus = 'open'

  if (!config.enabled) {
    registrationStatus = 'local_auth_unavailable'
  } else if (config.registrationMode === 'disabled') {
    registrationStatus = 'closed'
  } else if (inviteCodeRequired && inviteCodeCount === 0) {
    registrationStatus = totalInviteCount > 0 ? 'invite_codes_exhausted' : 'invite_codes_missing'
  } else if (registrationLimit !== null && totalUsers >= registrationLimit) {
    registrationStatus = 'limit_reached'
  }

  return {
    enabled: config.enabled,
    registrationMode: config.registrationMode,
    registrationEnabled: registrationStatus === 'open',
    registrationStatus,
    inviteCodeRequired,
    inviteSource: config.inviteSource || 'none',
    inviteCodes: config.inviteCodes || [],
    inviteCodeCount,
    totalInviteCount,
    registrationLimit,
    totalUsers,
    remainingSlots,
    source: config.source || 'environment',
    managedInvites: config.managedInvites || [],
    allManagedInvites: config.allManagedInvites || []
  }
}

function buildSettingsPayload(config) {
  return {
    registrationMode: config.registrationMode,
    registrationLimit: config.registrationLimit,
    inviteCodeCount: config.inviteCodeCount,
    totalInviteCount: config.totalInviteCount,
    source: config.source,
    registrationStatus: config.registrationStatus
  }
}

function buildStatsPayload(config, statsRecord) {
  return {
    totalUsers: config.totalUsers,
    enabledUsers: Number(statsRecord?.enabledUsers ?? config.totalUsers),
    disabledUsers: Number(statsRecord?.disabledUsers ?? 0),
    recentRegistrations: Number(statsRecord?.recentRegistrations ?? 0),
    recentLogins: Number(statsRecord?.recentLogins ?? 0),
    registrationLimit: config.registrationLimit,
    remainingSlots: config.remainingSlots,
    registrationStatus: config.registrationStatus,
    registrationMode: config.registrationMode,
    inviteCodeCount: config.inviteCodeCount,
    totalInviteCount: config.totalInviteCount
  }
}

async function fetchLocalAuthStats(db, config) {
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const record = await db
    .prepare(
      `SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabledUsers,
        SUM(CASE WHEN is_enabled = 0 THEN 1 ELSE 0 END) AS disabledUsers,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS recentRegistrations,
        SUM(CASE WHEN last_login_at IS NOT NULL AND last_login_at >= ? THEN 1 ELSE 0 END) AS recentLogins
      FROM local_users`
    )
    .bind(sinceIso, sinceIso)
    .first()

  return {
    ...record,
    totalUsers: Number(record?.totalUsers ?? config.totalUsers)
  }
}

async function listLocalUsers(db, limit = DEFAULT_USER_LIST_LIMIT) {
  const result = await db
    .prepare(
      `SELECT
        id,
        username,
        display_name,
        created_at,
        last_login_at,
        is_enabled
      FROM local_users
      ORDER BY created_at DESC
      LIMIT ?`
    )
    .bind(limit)
    .all()

  return (result.results || []).map((record) => ({
    id: Number(record.id),
    sessionId: `local:${record.id}`,
    username: record.username,
    displayName: record.display_name || record.username,
    createdAt: record.created_at || '',
    lastLoginAt: record.last_login_at || '',
    isEnabled: Boolean(record.is_enabled)
  }))
}

async function listLocalAuthInvites(db, config, limit = DEFAULT_INVITE_LIST_LIMIT) {
  const runtimeInvites = await readRuntimeLocalAuthInvites(db, limit)

  if (runtimeInvites.length) {
    return runtimeInvites.map(mapInviteForAdmin)
  }

  if (!config.inviteCodes.length) {
    return []
  }

  return config.inviteCodes.map((code, index) => ({
    id: `legacy-${index + 1}`,
    code,
    label: config.inviteSource === 'environment' ? '环境变量邀请码' : '旧版邀请码',
    maxUses: null,
    usedCount: null,
    remainingUses: null,
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
    lastUsedAt: '',
    source: config.inviteSource,
    editable: false
  }))
}

async function countLocalUsers(db) {
  const record = await db
    .prepare('SELECT COUNT(*) AS totalUsers FROM local_users')
    .first()

  return Number(record?.totalUsers ?? 0)
}

async function readRuntimeLocalAuthSettings(db) {
  const record = await db
    .prepare(
      `SELECT
        registration_mode,
        registration_limit,
        invite_codes,
        updated_at,
        updated_by
      FROM local_auth_settings
      WHERE id = ?`
    )
    .bind(LOCAL_AUTH_SETTINGS_ROW_ID)
    .first()

  if (!record) return null

  return {
    registrationMode: normalizeRegistrationMode(record.registration_mode),
    registrationLimit: normalizeRegistrationLimit(record.registration_limit),
    inviteCodes: parseInviteCodes(record.invite_codes),
    updatedAt: String(record.updated_at || ''),
    updatedBy: String(record.updated_by || '')
  }
}

async function readRuntimeLocalAuthInvites(db, limit = DEFAULT_INVITE_LIST_LIMIT) {
  const result = await db
    .prepare(
      `SELECT
        id,
        code,
        code_normalized,
        label,
        max_uses,
        used_count,
        is_enabled,
        created_at,
        updated_at,
        last_used_at,
        created_by
      FROM local_auth_invites
      ORDER BY created_at DESC
      LIMIT ?`
    )
    .bind(limit)
    .all()

  return (result.results || []).map((record) => ({
    id: Number(record.id),
    code: String(record.code || ''),
    codeNormalized: String(record.code_normalized || ''),
    label: String(record.label || ''),
    maxUses: normalizeInviteUsageLimit(record.max_uses),
    usedCount: Number(record.used_count || 0),
    remainingUses:
      record.max_uses === null || record.max_uses === undefined
        ? null
        : Math.max(Number(record.max_uses || 0) - Number(record.used_count || 0), 0),
    isEnabled: Boolean(record.is_enabled),
    createdAt: String(record.created_at || ''),
    updatedAt: String(record.updated_at || ''),
    lastUsedAt: String(record.last_used_at || ''),
    createdBy: String(record.created_by || '')
  }))
}

async function findLocalAuthInviteById(db, inviteId) {
  const record = await db
    .prepare(
      `SELECT
        id,
        code,
        code_normalized,
        label,
        max_uses,
        used_count,
        is_enabled,
        created_at,
        updated_at,
        last_used_at,
        created_by
      FROM local_auth_invites
      WHERE id = ?`
    )
    .bind(inviteId)
    .first()

  if (!record) return null

  return mapInviteForAdmin({
    id: Number(record.id),
    code: String(record.code || ''),
    codeNormalized: String(record.code_normalized || ''),
    label: String(record.label || ''),
    maxUses: normalizeInviteUsageLimit(record.max_uses),
    usedCount: Number(record.used_count || 0),
    remainingUses:
      record.max_uses === null || record.max_uses === undefined
        ? null
        : Math.max(Number(record.max_uses || 0) - Number(record.used_count || 0), 0),
    isEnabled: Boolean(record.is_enabled),
    createdAt: String(record.created_at || ''),
    updatedAt: String(record.updated_at || ''),
    lastUsedAt: String(record.last_used_at || ''),
    createdBy: String(record.created_by || '')
  })
}

function mapInviteForAdmin(invite) {
  return {
    id: invite.id,
    code: invite.code,
    label: invite.label,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    remainingUses: invite.remainingUses,
    isEnabled: invite.isEnabled,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    lastUsedAt: invite.lastUsedAt,
    createdBy: invite.createdBy || '',
    editable: true
  }
}

function canManagedInviteBeUsed(invite) {
  if (!invite.isEnabled) return false
  if (invite.remainingUses === null) return true
  return invite.remainingUses > 0
}

function countUsableInviteCodes(config) {
  if (config.inviteSource === 'managed') {
    return (config.managedInvites || []).length
  }

  return (config.inviteCodes || []).length
}

function countTotalInviteCodes(config) {
  if (config.inviteSource === 'managed' || (config.allManagedInvites || []).length) {
    return (config.allManagedInvites || []).length
  }

  if (config.inviteSource === 'runtime' || config.inviteSource === 'environment') {
    return (config.inviteCodes || []).length
  }

  return 0
}

function normalizeAuthInput(payload) {
  const username = String(payload?.username || '').trim()
  const displayName =
    String(payload?.name || payload?.displayName || username || '').trim() || '内测用户'

  return {
    username,
    usernameNormalized: normalizeUsername(username),
    displayName,
    password: String(payload?.password || ''),
    inviteCode: normalizeInviteCode(payload?.inviteCode)
  }
}

function normalizeRegistrationMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  return REGISTRATION_MODES.has(normalized) ? normalized : 'public'
}

function normalizeRegistrationLimit(value) {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  if (numeric < 1) return null
  return Math.floor(numeric)
}

function normalizeInviteUsageLimit(value) {
  if (value === null || value === undefined || value === '') return null

  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 1) {
    throw new LocalAuthError('invalid_invite_limit', '邀请码可用次数必须是大于 0 的整数。', 400)
  }

  return Math.floor(numeric)
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeInviteLabel(value) {
  return String(value || '').trim().slice(0, 48)
}

function parseInviteCodes(rawValue) {
  const seen = new Set()
  const inviteCodes = []

  String(rawValue || '')
    .split(/[\r\n,]+/)
    .map((item) => normalizeInviteCode(item))
    .filter(Boolean)
    .forEach((code) => {
      if (seen.has(code)) return
      seen.add(code)
      inviteCodes.push(code)
    })

  return inviteCodes
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeLocalUserId(value) {
  const numeric = Number(String(value || '').replace(/^local:/, ''))
  if (!Number.isInteger(numeric) || numeric < 1) return 0
  return numeric
}

function normalizeInviteId(value) {
  const numeric = Number(String(value || '').replace(/^invite:/, ''))
  if (!Number.isInteger(numeric) || numeric < 1) return 0
  return numeric
}

function generateInviteCode() {
  const segments = []
  for (let index = 0; index < 2; index += 1) {
    segments.push(randomHex(2).toUpperCase())
  }

  return `${GENERATED_INVITE_PREFIX}-${segments.join('-')}`
}

async function findLocalUserByNormalizedUsername(db, usernameNormalized) {
  if (!usernameNormalized) return null

  const record = await db
    .prepare(
      `SELECT
        id,
        username,
        username_normalized,
        display_name,
        password_hash,
        password_salt,
        password_iterations,
        created_at,
        last_login_at,
        is_enabled
      FROM local_users
      WHERE username_normalized = ?`
    )
    .bind(usernameNormalized)
    .first()

  return record || null
}

async function findLocalUserRecordById(db, id) {
  if (!id) return null

  const record = await db
    .prepare(
      `SELECT
        id,
        username,
        username_normalized,
        display_name,
        password_hash,
        password_salt,
        password_iterations,
        created_at,
        last_login_at,
        is_enabled
      FROM local_users
      WHERE id = ?`
    )
    .bind(id)
    .first()

  return record || null
}

async function ensureLocalAuthSchema(db) {
  if (!db) return

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS local_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            username_normalized TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            password_iterations INTEGER NOT NULL,
            is_enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at TEXT
          )`
        )
        .run()

      await db
        .prepare(
          'CREATE INDEX IF NOT EXISTS idx_local_users_username_normalized ON local_users (username_normalized)'
        )
        .run()

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS local_auth_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            registration_mode TEXT NOT NULL,
            registration_limit INTEGER,
            invite_codes TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            updated_by TEXT NOT NULL DEFAULT ''
          )`
        )
        .run()

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS local_auth_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL,
            code_normalized TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL DEFAULT '',
            max_uses INTEGER,
            used_count INTEGER NOT NULL DEFAULT 0,
            is_enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used_at TEXT,
            created_by TEXT NOT NULL DEFAULT ''
          )`
        )
        .run()

      await db
        .prepare(
          'CREATE INDEX IF NOT EXISTS idx_local_auth_invites_code_normalized ON local_auth_invites (code_normalized)'
        )
        .run()

      const columns = await db.prepare('PRAGMA table_info(local_users)').all()
      const hasEnabledColumn = (columns.results || []).some((column) => column.name === 'is_enabled')

      if (!hasEnabledColumn) {
        try {
          await db
            .prepare('ALTER TABLE local_users ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1')
            .run()
        } catch (error) {
          if (!String(error?.message || '').toLowerCase().includes('duplicate column')) {
            throw error
          }
        }
      }
    })().catch((error) => {
      schemaReadyPromise = null
      throw error
    })
  }

  return schemaReadyPromise
}

async function derivePasswordHash(password, saltHex, iterations) {
  const secret = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations
    },
    secret,
    256
  )

  return bytesToHex(new Uint8Array(bits))
}

function randomHex(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return bytesToHex(bytes)
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const pairs = hex.match(/.{1,2}/g) || []
  return Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)))
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false

  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}
