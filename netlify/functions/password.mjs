import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

async function supabaseRequest(
  path,
  options = {}
) {

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      "Supabase request failed"
    );
  }

  return data;
}

function hashPassword(password) {

  return new Promise((resolve, reject) => {

    const salt =
      crypto.randomBytes(16);

    crypto.scrypt(
      password,
      salt,
      64,
      {
        N: 16384,
        r: 8,
        p: 1
      },
      (error, derivedKey) => {

        if (error) {
          reject(error);
          return;
        }

        resolve(
          `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`
        );
      }
    );
  });
}

function verifyPassword(password, stored) {

  return new Promise((resolve, reject) => {

    const parts = stored.split("$");

    if (parts.length !== 3) {
      resolve(false);
      return;
    }

    const salt =
      Buffer.from(parts[1], "hex");

    const expected =
      Buffer.from(parts[2], "hex");

    crypto.scrypt(
      password,
      salt,
      expected.length,
      {
        N: 16384,
        r: 8,
        p: 1
      },
      (error, derivedKey) => {

        if (error) {
          reject(error);
          return;
        }

        resolve(
          crypto.timingSafeEqual(
            expected,
            derivedKey
          )
        );
      }
    );
  });
}

async function getAuthenticatedUser(request) {

  const auth =
    request.headers.get("authorization");

  if (!auth?.startsWith("Bearer ")) {
    return null;
  }

  const token =
    auth.substring(7);

  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${token}`
        }
      }
    );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export default async (request) => {

  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      405
    );
  }

  try {

    const body =
      await request.json();

    const action =
      body.action;

    // -------------------------------------------------------
    // SET PASSWORD
    // -------------------------------------------------------

    if (action === "set") {

      const user =
        await getAuthenticatedUser(request);

      if (!user) {
        return json(
          { error: "You must be logged in." },
          401
        );
      }

      const {
        checklistId,
        password
      } = body;

      if (!checklistId || !password) {
        return json(
          { error: "Checklist and password are required." },
          400
        );
      }

      if (password.length < 4) {
        return json(
          { error: "Password must be at least 4 characters." },
          400
        );
      }

      const lists =
        await supabaseRequest(
          `checklists?id=eq.${encodeURIComponent(checklistId)}&select=id,owner_id`
        );

      const list = lists?.[0];

      if (!list || list.owner_id !== user.id) {
        return json(
          { error: "You do not own this checklist." },
          403
        );
      }

      const hash =
        await hashPassword(password);

      await supabaseRequest(
        "checklist_access?on_conflict=checklist_id",
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            checklist_id: checklistId,
            password_hash: hash,
            updated_at: new Date().toISOString()
          })
        }
      );

      await supabaseRequest(
        `checklists?id=eq.${encodeURIComponent(checklistId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            has_password: true
          })
        }
      );

      return json({
        success: true
      });
    }

    // -------------------------------------------------------
    // VERIFY PASSWORD
    // -------------------------------------------------------

    if (action === "verify") {

      const {
        slug,
        password
      } = body;

      if (!slug || !password) {
        return json(
          { error: "Slug and password are required." },
          400
        );
      }

      const lists =
        await supabaseRequest(
          `checklists?slug=eq.${encodeURIComponent(slug)}&select=id,title,description,slug,owner_id,is_public,has_password`
        );

      const list = lists?.[0];

      if (!list || !list.has_password) {
        return json(
          { error: "Checklist not found." },
          404
        );
      }

      const accessRows =
        await supabaseRequest(
          `checklist_access?checklist_id=eq.${encodeURIComponent(list.id)}&select=password_hash`
        );

      const access =
        accessRows?.[0];

      if (!access) {
        return json(
          { error: "Password configuration is missing." },
          500
        );
      }

      const valid =
        await verifyPassword(
          password,
          access.password_hash
        );

      if (!valid) {
        return json(
          { error: "Incorrect password." },
          401
        );
      }

      const categories =
        await supabaseRequest(
          `categories?checklist_id=eq.${encodeURIComponent(list.id)}&select=id,checklist_id,name,position&order=position.asc`
        );

      for (const category of categories) {

        category.items =
          await supabaseRequest(
            `items?category_id=eq.${encodeURIComponent(category.id)}&select=id,category_id,text,position&order=position.asc`
          );
      }

      return json({
        success: true,
        checklist: list,
        categories
      });
    }

    return json(
      { error: "Unknown action." },
      400
    );

  } catch (error) {

    console.error(error);

    return json(
      { error: "Server error." },
      500
    );
  }
};