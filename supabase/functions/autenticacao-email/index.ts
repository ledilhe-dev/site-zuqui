import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-funcionario-id, x-loja-id, x-operational-token, x-global-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AuthAction = "send_verification" | "send_password_reset" | "consume_token" | "admin_set_employee_password" | "admin_set_employee_pin" | "admin_set_store_admin_password";

type TokenRow = {
  id: string;
  tipo: "verificacao_email" | "reset_senha";
  funcionario_id: string | null;
  email: string;
  expira_em: string;
  usado_em: string | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("AUTH_FROM_EMAIL") || Deno.env.get("ALERT_FROM_EMAIL") || "";
  const fromName = Deno.env.get("AUTH_FROM_NAME") || Deno.env.get("ALERT_FROM_NAME") || "CHECK DIARIO";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "") as AuthAction;

  try {
    if (action === "admin_set_employee_password" || action === "admin_set_employee_pin" || action === "admin_set_store_admin_password") {
      const actorId = normalizeOptionalUuid(body.actorId);
      const actorType = String(body.actorType || "").trim();
      const actorPassword = String(body.actorPassword || "").trim();
      const targetId = normalizeOptionalUuid(body.targetId);
      const newPassword = String(body.newPassword || "").trim();
      if (!actorId || !targetId || !actorPassword) {
        return jsonResponse({ error: "Confirmação do administrador incompleta." }, 400);
      }
      const minimo = action === "admin_set_employee_pin" ? 4 : 8;
      if (newPassword.length < minimo) {
        return jsonResponse({ error: action === "admin_set_employee_pin" ? "O PIN deve ter pelo menos 4 caracteres." : "A nova senha deve ter pelo menos 8 caracteres." }, 400);
      }
      const authorized = await canManageCredentials(admin, actorType, actorId, actorPassword);
      if (!authorized) {
        return jsonResponse({ error: "PIN operacional/senha inválida ou perfil sem permissão para editar funcionários." }, 403);
      }
      const rpcName = action === "admin_set_employee_password"
        ? "definir_credencial_funcionario"
        : action === "admin_set_employee_pin"
          ? "definir_pin_funcionario"
          : "definir_credencial_usuario_admin";
      const args = action === "admin_set_employee_password"
        ? { p_funcionario_id: targetId, p_nova_senha: newPassword }
        : action === "admin_set_employee_pin"
          ? { p_funcionario_id: targetId, p_novo_pin: newPassword }
          : { p_usuario_id: targetId, p_nova_senha: newPassword };
      const { error: setError } = await admin.rpc(rpcName, args);
      if (setError) return jsonResponse({ error: setError.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (action === "send_verification") {
      ensureEmailProvider(resendApiKey, fromEmail);
      const email = normalizeEmail(body.email);
      const employeeId = normalizeOptionalUuid(body.funcionarioId || body.employeeId);
      const redirectUrl = normalizeRedirectUrl(body.redirectUrl);
      const employee = await findEmployeeByEmail(admin, email, employeeId);

      if (!employee) {
        return jsonResponse({ error: "Nenhum usuário encontrado para este e-mail." }, 404);
      }

      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      await replaceToken(admin, {
        tipo: "verificacao_email",
        funcionarioId: employee.id,
        empresaId: employee.empresa_id,
        email,
        token,
        expiresAt: minutesFromNow(60 * 24),
      });

      const verificationUrl = `${redirectUrl}?auth_action=verify_email&token=${encodeURIComponent(token)}`;
      await sendEmail(resendApiKey, fromEmail, fromName, {
        to: [email],
        subject: "CHECK DIARIO: confirme seu e-mail",
        html: buildVerificationEmail(employee.nome || "Usuário", verificationUrl),
      });

      return jsonResponse({ ok: true });
    }

    if (action === "send_password_reset") {
      ensureEmailProvider(resendApiKey, fromEmail);
      const email = normalizeEmail(body.email);
      const redirectUrl = normalizeRedirectUrl(body.redirectUrl);
      const employee = await findEmployeeByEmail(admin, email);

      if (!employee) {
        return jsonResponse({ error: "Nenhum usuário encontrado para este e-mail." }, 404);
      }

      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      await replaceToken(admin, {
        tipo: "reset_senha",
        funcionarioId: employee.id,
        empresaId: employee.empresa_id,
        email,
        token,
        expiresAt: minutesFromNow(30),
      });

      const resetUrl = `${redirectUrl}?auth_action=reset_password&token=${encodeURIComponent(token)}`;
      await sendEmail(resendApiKey, fromEmail, fromName, {
        to: [email],
        subject: "CHECK DIARIO: redefinição de senha",
        html: buildResetEmail(employee.nome || "Usuário", resetUrl),
      });

      return jsonResponse({ ok: true });
    }

    if (action === "consume_token") {
      const token = String(body.token || "").trim();
      const tokenType = String(body.tokenType || "").trim();

      if (!token) {
        return jsonResponse({ error: "Token não informado." }, 400);
      }

      if (tokenType !== "verificacao_email" && tokenType !== "reset_senha") {
        return jsonResponse({ error: "Tipo de token inválido." }, 400);
      }

      const tokenHash = await sha256(token);
      const { data: tokenRow, error: tokenError } = await admin
        .from("email_tokens_auth")
        .select("id, tipo, funcionario_id, email, expira_em, usado_em")
        .eq("token_hash", tokenHash)
        .eq("tipo", tokenType)
        .maybeSingle();

      if (tokenError) {
        return jsonResponse({ error: tokenError.message }, 500);
      }

      if (!tokenRow) {
        return jsonResponse({ error: "Token inválido ou inexistente." }, 404);
      }

      if (tokenRow.usado_em) {
        return jsonResponse({ error: "Este link já foi utilizado." }, 400);
      }

      if (new Date(tokenRow.expira_em).getTime() < Date.now()) {
        return jsonResponse({ error: "Este link expirou." }, 400);
      }

      if (tokenType === "verificacao_email") {
        if (!tokenRow.funcionario_id) {
          return jsonResponse({ error: "Funcionário do token não encontrado." }, 400);
        }

        const { error: verifyError } = await admin
          .from("funcionarios")
          .update({ email_verificado: true })
          .eq("id", tokenRow.funcionario_id);

        if (verifyError) {
          return jsonResponse({ error: verifyError.message }, 500);
        }
      }

      if (tokenType === "reset_senha") {
        const newPassword = String(body.newPassword || "").trim();
        if (newPassword.length < 8) {
          return jsonResponse({ error: "A nova senha deve ter pelo menos 8 caracteres." }, 400);
        }

        if (!tokenRow.funcionario_id) {
          return jsonResponse({ error: "Funcionário do token não encontrado." }, 400);
        }

        const { error: resetError } = await admin.rpc("definir_credencial_funcionario", {
          p_funcionario_id: tokenRow.funcionario_id,
          p_nova_senha: newPassword,
        });

        if (resetError) {
          return jsonResponse({ error: resetError.message }, 500);
        }
      }

      const { error: useError } = await admin
        .from("email_tokens_auth")
        .update({ usado_em: new Date().toISOString() })
        .eq("id", tokenRow.id);

      if (useError) {
        return jsonResponse({ error: useError.message }, 500);
      }

      return jsonResponse({ ok: true, tokenType, email: tokenRow.email });
    }

    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro inesperado na autenticação por e-mail." },
      500,
    );
  }
});

function normalizeEmail(value: unknown) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("E-mail inválido.");
  }
  return email;
}

function normalizeRedirectUrl(value: unknown) {
  const redirectUrl = String(value || "").trim();
  if (!redirectUrl.startsWith("http://") && !redirectUrl.startsWith("https://")) {
    throw new Error("URL de retorno inválida.");
  }
  return redirectUrl;
}

function ensureEmailProvider(apiKey: string, fromEmail: string) {
  if (!apiKey || !fromEmail) {
    throw new Error("As variáveis de e-mail não foram configuradas no backend.");
  }
}

async function canManageCredentials(
  admin: ReturnType<typeof createClient>,
  actorType: string,
  actorId: string,
  actorPassword: string,
) {
  if (actorType === "admin_loja") {
    const [{ data: loginValido }, { data: pinValido }] = await Promise.all([
      admin.rpc("verificar_credencial_usuario_admin", {
        p_usuario_id: actorId,
        p_senha: actorPassword,
      }),
      admin.rpc("verificar_pin_usuario_admin", {
        p_usuario_id: actorId,
        p_pin: actorPassword,
      }),
    ]);
    return loginValido === true || pinValido === true;
  }

  const [{ data: senhaValida }, { data: pinValido }] = await Promise.all([
    admin.rpc("verificar_senha_funcionario", {
      p_funcionario_id: actorId,
      p_senha: actorPassword,
    }),
    admin.rpc("verificar_credencial_funcionario", {
      p_funcionario_id: actorId,
      p_senha: actorPassword,
    }),
  ]);
  if (senhaValida !== true && pinValido !== true) return false;

  const { data: employee } = await admin
    .from("funcionarios")
    .select("id, ativo, é_administrador, perfis(codigo, permissoes)")
    .eq("id", actorId)
    .eq("ativo", true)
    .maybeSingle();
  if (!employee) return false;
  if (employee.é_administrador === true) return true;
  const profile = Array.isArray(employee.perfis) ? employee.perfis[0] : employee.perfis;
  const code = String(profile?.codigo || "").toUpperCase();
  const permissions = (profile?.permissoes || {}) as Record<string, unknown>;
  return code === "ADM" || code === "MASTER" || permissions.funcionarios === true;
}

async function findEmployeeByEmail(admin: ReturnType<typeof createClient>, email: string, employeeId?: string) {
  if (employeeId) {
    const { data, error } = await admin
      .from("funcionarios")
      .select("id, nome, email, email_verificado, ativo, empresa_id")
      .eq("id", employeeId)
      .eq("ativo", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      if (String(data.email || "").trim().toLowerCase() !== email) {
        throw new Error("O e-mail informado nao corresponde ao funcionario localizado. Salve o cadastro e tente reenviar.");
      }
      return data;
    }
  }

  const { data, error } = await admin
    .from("funcionarios")
    .select("id, nome, email, email_verificado, ativo, empresa_id")
    .eq("email", email)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function normalizeOptionalUuid(value: unknown) {
  const id = String(value || "").trim();
  if (!id) return "";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error("Identificador do funcionario invalido.");
  }
  return id;
}

async function replaceToken(
  admin: ReturnType<typeof createClient>,
  params: {
    tipo: "verificacao_email" | "reset_senha";
    funcionarioId: string | null;
    empresaId: string | null;
    email: string;
    token: string;
    expiresAt: string;
  },
) {
  const tokenHash = await sha256(params.token);
  const { error } = await admin.from("email_tokens_auth").insert([{
    tipo: params.tipo,
    funcionario_id: params.funcionarioId,
    empresa_id: params.empresaId,
    email: params.email,
    token_hash: tokenHash,
    expira_em: params.expiresAt,
  }]);

  if (error) {
    throw new Error(error.message);
  }
}

async function sendEmail(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  params: { to: string[]; subject: string; html: string },
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw mapEmailProviderError(errorText, fromEmail);
  }
}

function mapEmailProviderError(errorText: string, fromEmail: string) {
  const fallbackMessage = "Nao foi possivel enviar o e-mail agora.";
  const parsed = parseJsonSafely<Record<string, unknown>>(errorText);
  const providerMessage = firstString(
    parsed?.message,
    parsed?.error,
    parsed?.details,
    errorText,
  );

  if (typeof providerMessage === "string") {
    const normalizedMessage = providerMessage.toLowerCase();
    if (normalizedMessage.includes("domain is not verified")) {
      const domain = extractEmailDomain(fromEmail);
      const domainLabel = domain ? ` ${domain}` : "";
      return new Error(
        `O dominio de envio${domainLabel} ainda nao foi verificado no Resend. Verifique e valide o dominio configurado no remetente antes de reenviar o e-mail.`,
      );
    }

    if (normalizedMessage.includes("api key")) {
      return new Error("A chave do provedor de e-mail no backend e invalida ou nao foi configurada corretamente.");
    }
  }

  return new Error(providerMessage || fallbackMessage);
}

function parseJsonSafely<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function extractEmailDomain(email: string) {
  const parts = String(email || "").split("@");
  return parts.length === 2 ? parts[1].trim() : "";
}

function buildVerificationEmail(name: string, verificationUrl: string) {
  return buildAuthEmail({
    title: "Confirme seu e-mail",
    message: `Olá, ${escapeHtml(name)}. Confirme seu e-mail para ativar o login no CHECK DIARIO.`,
    ctaLabel: "Confirmar e-mail",
    ctaUrl: verificationUrl,
    footer: "Se você não solicitou este acesso, ignore esta mensagem.",
  });
}

function buildResetEmail(name: string, resetUrl: string) {
  return buildAuthEmail({
    title: "Redefina sua senha",
    message: `Olá, ${escapeHtml(name)}. Clique no botão abaixo para cadastrar uma nova senha de acesso.`,
    ctaLabel: "Redefinir senha",
    ctaUrl: resetUrl,
    footer: "Este link expira em 30 minutos.",
  });
}

function buildAuthEmail(params: { title: string; message: string; ctaLabel: string; ctaUrl: string; footer: string }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#0a0f0d;padding:32px;color:#e2f0e4">
      <div style="max-width:640px;margin:0 auto;background:#111a14;border:1px solid #1f2e22;border-radius:18px;overflow:hidden">
        <div style="padding:24px 28px;border-bottom:1px solid #1f2e22;background:linear-gradient(135deg,#111a14 0%,#182218 100%)">
          <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#6b8f70;margin-bottom:8px">CHECK DIARIO</div>
          <div style="font-size:24px;font-weight:700;color:#e2f0e4">${params.title}</div>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#e2f0e4">${params.message}</p>
          <a href="${params.ctaUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#22c55e;color:#04110a;text-decoration:none;font-weight:700">
            ${params.ctaLabel}
          </a>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#6b8f70">${params.footer}</p>
        </div>
      </div>
    </div>
  `;
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
