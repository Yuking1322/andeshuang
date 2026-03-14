import { isSameOriginRequest, json, readJson, requireAdminRequest } from '../../../../_shared/admin.js'
import { deleteLocalUser, getLocalAuthAdminSnapshot, LocalAuthError } from '../../../../_shared/local-auth.js'

export async function onRequestPost(context) {
  if (!isSameOriginRequest(context.request)) {
    return json(
      {
        ok: false,
        error: 'forbidden_origin',
        message: '当前请求来源不被允许。'
      },
      403
    )
  }

  const admin = await requireAdminRequest(context)
  if (!admin.ok) {
    return admin.response
  }

  const body = await readJson(context.request)
  if (!body.ok) {
    return json(
      {
        ok: false,
        error: 'invalid_payload',
        message: '提交内容格式不正确，请刷新后重试。'
      },
      400
    )
  }

  try {
    await deleteLocalUser(
      context.env.AUTH_DB,
      body.value?.userId,
      admin.user
    )

    const authManagement = await getLocalAuthAdminSnapshot(context.env)
    return json({
      ok: true,
      authManagement
    })
  } catch (error) {
    if (error instanceof LocalAuthError) {
      return json(
        {
          ok: false,
          error: error.code,
          message: error.message
        },
        error.status
      )
    }

    return json(
      {
        ok: false,
        error: 'user_delete_failed',
        message: '账号删除失败，请稍后重试。'
      },
      500
    )
  }
}
