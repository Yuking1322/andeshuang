const PASSWORD_ITERATIONS = 210000
const USERNAME_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,23}$/

export function hasLocalAuthDatabase(env) {
  return Boolean(env.AUTH_DB)
}

export function validateRegistrationInput(payload) {
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
      message: '密码长度需在 8 到 128 位之间。'
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

    const created = await findLocalUserById(db, result.meta?.last_row_id)
    return created
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('unique')) {
      throw new LocalAuthError('username_taken', '这个用户名已经被注册了。', 409)
    }

    throw error
  }
}

export async function authenticateLocalUser(db, username, password) {
  const user = await findLocalUserByNormalizedUsername(db, normalizeUsername(username))
  if (!user) return null

  const derived = await derivePasswordHash(password, user.password_salt, user.password_iterations)
  if (!constantTimeEqual(derived, user.password_hash)) {
    return null
  }

  await db
    .prepare('UPDATE local_users SET last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), user.id)
    .run()

  return mapLocalUser(user)
}

export async function findLocalUserById(db, id) {
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
        last_login_at
      FROM local_users
      WHERE id = ?`
    )
    .bind(id)
    .first()

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

function normalizeAuthInput(payload) {
  return {
    username: String(payload?.username || '').trim(),
    usernameNormalized: normalizeUsername(payload?.username),
    displayName: String(payload?.name || payload?.displayName || payload?.username || '').trim() || '内测用户',
    password: String(payload?.password || '')
  }
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
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
        last_login_at
      FROM local_users
      WHERE username_normalized = ?`
    )
    .bind(usernameNormalized)
    .first()

  return record || null
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
