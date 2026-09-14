const SUPABASE_URL =
    "https://ufyijnqhqwlnlfyyfncl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_--jdcO776FaSYi3AUTCKWg_PCfINlGC";

const { createClient } = window.supabase;

const db = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

const main = document.getElementById("main");
const nav = document.getElementById("nav");
const toast = document.getElementById("toast");

let currentSession = null;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);
}

async function getSession() {
    const { data } = await db.auth.getSession();
    currentSession = data.session;
    return currentSession;
}

async function refreshNav() {
    await getSession();

    if (currentSession) {
        nav.innerHTML = `
      <div class="nav-links">
        <a href="/" class="btn secondary">Home</a>
        <a href="/?page=dashboard" class="btn secondary">Dashboard</a>
        <button class="btn" id="logoutBtn">Logout</button>
      </div>
    `;

        document
            .getElementById("logoutBtn")
            ?.addEventListener("click", async () => {
                await db.auth.signOut();
                window.location.href = "/";
            });

    } else {
        nav.innerHTML = `
      <div class="nav-links">
        <a href="/?page=login" class="btn secondary">Login</a>
        <a href="/?page=signup" class="btn">Get Started</a>
      </div>
    `;
    }
}

function layout(content) {
    return `
    <div class="container">
      ${content}
    </div>
  `;
}

async function homePage() {
    await refreshNav();

    main.innerHTML = layout(`
    <section class="hero">
      <div class="badge">✈️ Travel planning made simple</div>

      <h1>Plan. Pack.<br>Travel.</h1>

      <p>
        Create beautiful checklists for every trip,
        share them with friends and family,
        and never forget the important stuff.
      </p>

      <div class="actions">
        ${currentSession
            ? `<a href="/?page=create" class="btn">+ Create Checklist</a>`
            : `<a href="/?page=signup" class="btn">Create Your First Checklist</a>`
        }
        <a href="#featured" class="btn secondary">Explore</a>
      </div>
    </section>

    <section id="featured" class="section">
      <div class="section-title">
        <h2>Public Checklists</h2>
      </div>

      <div id="publicLists" class="grid">
        <div class="empty">Loading checklists...</div>
      </div>
    </section>
  `);

    const { data, error } = await db
        .from("checklists")
        .select("*")
        .eq("is_public", true)
        .eq("has_password", false)
        .order("created_at", { ascending: false })
        .limit(12);

    const container = document.getElementById("publicLists");

    if (error) {
        container.innerHTML = `
      <div class="empty">
        Unable to load checklists.
      </div>
    `;
        return;
    }

    if (!data?.length) {
        container.innerHTML = `
      <div class="empty">
        No public checklists yet.<br>
        Be the first to create one!
      </div>
    `;
        return;
    }

    container.innerHTML = data.map(list => `
    <a class="card" href="/checklist/${encodeURIComponent(list.slug)}">
      <span class="badge">📋 Checklist</span>

      <h3>${escapeHtml(list.title)}</h3>

      <p>${escapeHtml(list.description || "No description")}</p>

      <strong>Open →</strong>
    </a>
  `).join("");
}

function authPage(mode = "login") {
    main.innerHTML = layout(`
    <div class="form-card">

      <div class="auth-tabs">
        <button
          class="${mode === "login" ? "active" : ""}"
          id="loginTab"
        >
          Login
        </button>

        <button
          class="${mode === "signup" ? "active" : ""}"
          id="signupTab"
        >
          Sign up
        </button>
      </div>

      <h2>
        ${mode === "login" ? "Welcome back 👋" : "Create your account"}
      </h2>

      <p style="color:var(--muted)">
        ${mode === "login"
            ? "Sign in to manage your travel checklists."
            : "Create and share checklists for every trip."
        }
      </p>

      <form id="authForm">

        <div class="form-group">
          <label>Email</label>
          <input
            type="email"
            id="email"
            required
            placeholder="you@example.com"
          >
        </div>

        <div class="form-group">
          <label>Password</label>
          <input
            type="password"
            id="password"
            required
            minlength="6"
            placeholder="At least 6 characters"
          >
        </div>

        <button class="btn" type="submit">
          ${mode === "login" ? "Login" : "Create account"}
        </button>

      </form>
    </div>
  `);

    document.getElementById("loginTab").onclick = () => {
        window.location.href = "/?page=login";
    };

    document.getElementById("signupTab").onclick = () => {
        window.location.href = "/?page=signup";
    };

    document.getElementById("authForm").onsubmit = async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        let result;

        if (mode === "login") {
            result = await db.auth.signInWithPassword({
                email,
                password
            });
        } else {
            result = await db.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });
        }

        if (result.error) {
            showToast(result.error.message);
            return;
        }

        if (mode === "signup" && !result.data.session) {
            showToast("Check your email to confirm your account.");
            return;
        }

        window.location.href = "/?page=dashboard";
    };
}

async function dashboardPage() {
    if (!await getSession()) {
        window.location.href = "/?page=login";
        return;
    }

    await refreshNav();

    main.innerHTML = layout(`
    <section class="section">

      <div class="section-title">
        <div>
          <h2>My Checklists</h2>
          <p style="color:var(--muted)">
            Create and manage your travel lists.
          </p>
        </div>

        <a href="/?page=create" class="btn">
          + Create
        </a>
      </div>

      <div id="myLists" class="grid">
        <div class="empty">Loading...</div>
      </div>

    </section>
  `);

    const { data, error } = await db
        .from("checklists")
        .select("*")
        .eq("owner_id", currentSession.user.id)
        .order("created_at", { ascending: false });

    const container = document.getElementById("myLists");

    if (error) {
        container.innerHTML = `
      <div class="empty">${escapeHtml(error.message)}</div>
    `;
        return;
    }

    if (!data.length) {
        container.innerHTML = `
      <div class="empty">
        You haven't created a checklist yet.
        <br><br>
        <a href="/?page=create" class="btn">Create one</a>
      </div>
    `;
        return;
    }

    container.innerHTML = data.map(list => `
    <div class="card">

      <span class="badge">
        ${list.has_password ? "🔒 Protected" : "🌐 Public"}
      </span>

      <h3>${escapeHtml(list.title)}</h3>

      <p>${escapeHtml(list.description || "")}</p>

      <div class="actions" style="justify-content:flex-start">
        <a
          class="btn"
          href="/checklist/${encodeURIComponent(list.slug)}"
        >
          Open
        </a>

        <button
          class="btn secondary delete-list"
          data-id="${list.id}"
        >
          Delete
        </button>
      </div>

    </div>
  `).join("");

    document.querySelectorAll(".delete-list").forEach(button => {
        button.onclick = async () => {

            if (!confirm("Delete this checklist permanently?")) {
                return;
            }

            const { error } = await db
                .from("checklists")
                .delete()
                .eq("id", button.dataset.id);

            if (error) {
                showToast(error.message);
                return;
            }

            showToast("Checklist deleted.");
            dashboardPage();
        };
    });
}

async function createPage() {
    if (!await getSession()) {
        window.location.href = "/?page=login";
        return;
    }

    await refreshNav();

    main.innerHTML = layout(`
    <div class="form-card">

      <h2>Create a checklist</h2>

      <p style="color:var(--muted)">
        Create a checklist that you can share with anyone.
      </p>

      <form id="createForm">

        <div class="form-group">
          <label>Title</label>
          <input
            id="title"
            required
            placeholder="Ladakh Trip"
          >
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea
            id="description"
            placeholder="Things to pack for our Ladakh trip..."
          ></textarea>
        </div>

        <div class="form-group">
          <label>Access</label>

          <select id="access">
            <option value="public">
              🌐 Public
            </option>

            <option value="password">
              🔒 Password protected
            </option>

            <option value="private">
              👤 Private
            </option>
          </select>
        </div>

        <div
          class="form-group"
          id="passwordGroup"
          style="display:none"
        >
          <label>Share password</label>

          <input
            type="password"
            id="sharePassword"
            minlength="4"
            placeholder="Set a password"
          >
        </div>

        <div class="form-group">
          <label>First category</label>
          <input
            id="category"
            value="Packing"
            required
          >
        </div>

        <div class="form-group">
          <label>Items</label>

          <div id="items">
            <input class="item-input" placeholder="Innerwear + towel">
            <input class="item-input" placeholder="Fleece + down jacket">
            <input class="item-input" placeholder="Gloves">
          </div>

          <br>

          <button
            type="button"
            class="btn secondary"
            id="addItem"
          >
            + Add item
          </button>
        </div>

        <button class="btn" type="submit">
          Create Checklist
        </button>

      </form>
    </div>
  `);

    document.getElementById("access").onchange = event => {
        document.getElementById("passwordGroup").style.display =
            event.target.value === "password"
                ? "block"
                : "none";
    };

    document.getElementById("addItem").onclick = () => {
        const input = document.createElement("input");

        input.className = "item-input";
        input.placeholder = "Another item";
        input.style.marginTop = "8px";

        document.getElementById("items").appendChild(input);
    };

    document.getElementById("createForm").onsubmit = async event => {
        event.preventDefault();

        const title = document.getElementById("title").value.trim();
        const description =
            document.getElementById("description").value.trim();

        const access =
            document.getElementById("access").value;

        const sharePassword =
            document.getElementById("sharePassword").value;

        const category =
            document.getElementById("category").value.trim();

        let slug = slugify(title);

        if (!slug) {
            showToast("Please enter a valid title.");
            return;
        }

        const { data: existing } = await db
            .from("checklists")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();

        if (existing) {
            slug += "-" + Math.random().toString(36).slice(2, 7);
        }

        const isPublic = access !== "private";

        const { data: list, error } = await db
            .from("checklists")
            .insert({
                title,
                description,
                slug,
                owner_id: currentSession.user.id,
                is_public: isPublic,
                has_password: access === "password"
            })
            .select()
            .single();

        if (error) {
            showToast(error.message);
            return;
        }

        const { data: cat, error: categoryError } =
            await db
                .from("categories")
                .insert({
                    checklist_id: list.id,
                    name: category,
                    position: 0
                })
                .select()
                .single();

        if (categoryError) {
            showToast(categoryError.message);
            return;
        }

        const itemInputs =
            [...document.querySelectorAll(".item-input")];

        const itemRows = itemInputs
            .map((input, index) => ({
                category_id: cat.id,
                text: input.value.trim(),
                position: index
            }))
            .filter(item => item.text);

        if (itemRows.length) {
            const { error: itemsError } =
                await db
                    .from("items")
                    .insert(itemRows);

            if (itemsError) {
                showToast(itemsError.message);
                return;
            }
        }

        if (access === "password") {

            if (!sharePassword) {
                showToast("Please enter a share password.");
                return;
            }
const passwordResponse = await fetch(
    "/.netlify/functions/password",
    {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization:
                `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({
            action: "set",
            checklistId: list.id,
            password: sharePassword
        })
    }
);

const passwordResult =
    await passwordResponse.json();

console.log(
    "Set password response:",
    passwordResponse.status,
    passwordResult
);

if (!passwordResponse.ok) {
    showToast(
        passwordResult.error ||
        "Could not set password."
    );
    return;
}

showToast("Password saved successfully!");


            if (!passwordResponse.ok) {
                showToast(passwordResult.error || "Password setup failed.");
                return;
            }
        }

        window.location.href =
            `/checklist/${encodeURIComponent(slug)}`;
    };
}

async function fetchChecklist(slug) {

    const { data, error } = await db
        .from("checklists")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

async function loadPublicChecklist(list) {

    const { data: categories, error: catError } =
        await db
            .from("categories")
            .select("*")
            .eq("checklist_id", list.id)
            .order("position");

    if (catError) throw catError;

    for (const category of categories) {

        const { data: items, error } =
            await db
                .from("items")
                .select("*")
                .eq("category_id", category.id)
                .order("position");

        if (error) throw error;

        category.items = items;
    }

    return categories;
}

function getProgress(listId, categories) {

    const key = `triplist:${listId}`;

    const saved =
        JSON.parse(localStorage.getItem(key) || "{}");

    let total = 0;
    let completed = 0;

    categories.forEach(category => {
        category.items.forEach(item => {
            total++;

            if (saved[item.id]) {
                completed++;
            }
        });
    });

    return {
        total,
        completed,
        percent: total
            ? Math.round(completed / total * 100)
            : 0,
        saved
    };
}

function saveProgress(listId, saved) {
    localStorage.setItem(
        `triplist:${listId}`,
        JSON.stringify(saved)
    );
}

function renderChecklist(list, categories) {

    const progress =
        getProgress(list.id, categories);

    main.innerHTML = layout(`
    <section class="checklist-header">

      <span class="badge">
        ${list.has_password ? "🔒 Protected" : "📋 Checklist"}
      </span>

      <h1>${escapeHtml(list.title)}</h1>

      <p class="checklist-description">
        ${escapeHtml(list.description || "")}
      </p>

      <div class="progress-box">

        <strong>
          ${progress.percent}% complete
        </strong>

        <span style="color:var(--muted); margin-left:8px">
          ${progress.completed}/${progress.total}
        </span>

        <div class="progress-track">
          <div
            class="progress-bar"
            id="progressBar"
            style="width:${progress.percent}%"
          ></div>
        </div>

      </div>

      <div class="share-row">

        <button class="btn" id="shareBtn">
          🔗 Share
        </button>

        <button class="btn secondary" id="copyBtn">
          📋 Copy link
        </button>

        <button class="btn secondary" id="printBtn">
          🖨️ Print / PDF
        </button>

        ${currentSession &&
            currentSession.user.id === list.owner_id
            ? `
              <a
                class="btn secondary"
                href="/?page=dashboard"
              >
                ⚙️ Dashboard
              </a>
            `
            : ""
        }

      </div>

    </section>

    <section id="checklistBody">

      ${categories.length
            ? categories.map(category => `
              <div class="category">

                <h3>
                  ${escapeHtml(category.name)}
                </h3>

                ${category.items.map(item => `
                    <label
                      class="item ${progress.saved[item.id] ? "done" : ""
                }"
                    >

                      <input
                        type="checkbox"
                        data-item="${item.id}"
                        ${progress.saved[item.id] ? "checked" : ""}
                      >

                      <span>
                        ${escapeHtml(item.text)}
                      </span>

                    </label>
                  `).join("")
                }

              </div>
            `).join("")
            : `<div class="empty">No items yet.</div>`
        }

    </section>
  `);

    document.querySelectorAll(
        'input[type="checkbox"][data-item]'
    ).forEach(checkbox => {

        checkbox.onchange = () => {

            const saved =
                getProgress(list.id, categories).saved;

            saved[checkbox.dataset.item] =
                checkbox.checked;

            saveProgress(list.id, saved);

            checkbox
                .closest(".item")
                .classList.toggle(
                    "done",
                    checkbox.checked
                );

            const updated =
                getProgress(list.id, categories);

            document.getElementById("progressBar").style.width =
                `${updated.percent}%`;

            const progressText =
                document.querySelector(".progress-box strong");

            progressText.textContent =
                `${updated.percent}% complete`;
        };
    });

    document.getElementById("printBtn").onclick =
        () => window.print();

    document.getElementById("copyBtn").onclick =
        async () => {

            await navigator.clipboard.writeText(
                window.location.href
            );

            showToast("Link copied!");
        };

    document.getElementById("shareBtn").onclick =
        async () => {

            if (navigator.share) {
                await navigator.share({
                    title: list.title,
                    text: list.description || "Travel checklist",
                    url: window.location.href
                });
            } else {
                await navigator.clipboard.writeText(
                    window.location.href
                );

                showToast("Share link copied!");
            }
        };
}

async function protectedChecklistPage(slug, list) {

    main.innerHTML = `
    <div class="lock-card">

      <div class="lock-icon">🔒</div>

      <h2>${escapeHtml(list.title)}</h2>

      <p style="color:var(--muted)">
        This checklist is password protected.
      </p>

      <form id="unlockForm">

        <div class="form-group">
          <input
            type="password"
            id="unlockPassword"
            placeholder="Enter password"
            required
          >
        </div>

        <button class="btn">
          Unlock Checklist
        </button>

      </form>

    </div>
  `;

    document.getElementById("unlockForm").onsubmit =
        async event => {

            event.preventDefault();

            const password =
                document.getElementById("unlockPassword").value;

            const response =
                await fetch("/.netlify/functions/password", {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        action: "verify",
                        slug,
                        password
                    })
                });

            const result = await response.json();

            if (!response.ok) {
                showToast(result.error || "Wrong password.");
                return;
            }

            renderChecklist(
                result.checklist,
                result.categories
            );
        };
}

async function checklistPage(slug) {

    await refreshNav();

    try {

        const list = await fetchChecklist(slug);

        if (!list) {
            main.innerHTML = layout(`
        <div class="empty">
          <h2>Checklist not found</h2>
          <p>This checklist may have been deleted.</p>
        </div>
      `);
            return;
        }

        if (list.has_password) {
            await protectedChecklistPage(slug, list);
            return;
        }

        if (!list.is_public) {

            if (
                !currentSession ||
                currentSession.user.id !== list.owner_id
            ) {
                main.innerHTML = `
          <div class="lock-card">
            <div class="lock-icon">🔒</div>
            <h2>Private checklist</h2>
            <p>Only the owner can access this checklist.</p>
          </div>
        `;

                return;
            }
        }

        const categories =
            await loadPublicChecklist(list);

        renderChecklist(list, categories);

    } catch (error) {

        console.error(error);

        main.innerHTML = `
      <div class="empty">
        <h2>Something went wrong</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
    }
}

async function router() {

    const path =
        window.location.pathname.replace(/\/+$/, "") || "/";

    const params =
        new URLSearchParams(window.location.search);

    const page =
        params.get("page");

    if (path.startsWith("/checklist/")) {

        const slug =
            decodeURIComponent(
                path.split("/checklist/")[1]
            );

        await checklistPage(slug);
        return;
    }

    if (page === "login") {
        await refreshNav();
        authPage("login");
        return;
    }

    if (page === "signup") {
        await refreshNav();
        authPage("signup");
        return;
    }

    if (page === "dashboard") {
        await dashboardPage();
        return;
    }

    if (page === "create") {
        await createPage();
        return;
    }

    await homePage();
}

db.auth.onAuthStateChange(() => {
    setTimeout(() => refreshNav(), 0);
});

router();