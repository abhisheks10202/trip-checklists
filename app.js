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
        ? `
            <a href="/?page=create" class="btn">
                + Create Checklist
            </a>

            <a href="/?page=expenses" class="btn secondary">
                💰 Expenses
            </a>
        `
        : `
            <a href="/?page=signup" class="btn">
                Create Your First Checklist
            </a>

            <a href="/?page=login" class="btn secondary">
                💰 Expenses
            </a>
        `
    }

    <a href="#featured" class="btn secondary">
        Explore
    </a>

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

// async function fetchChecklist(slug) {

//     const { data, error } = await db
//         .from("checklists")
//         .select("*")
//         .eq("slug", slug)
//         .maybeSingle();

//     if (error) {
//         throw error;
//     }

//     return data;
// }

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

async function fetchProtectedChecklist(slug) {
    const response = await fetch(
        "/.netlify/functions/password",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "get",
                slug: slug
            })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.error || "Checklist not found."
        );
    }

    return result.checklist;
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

  <a
    class="btn secondary"
    href="/?page=expenses&checklist=${encodeURIComponent(list.id)}"
  >
    💰 Expenses
  </a>

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

async function expensesPage() {

    await refreshNav();

    if (!currentSession) {
        window.location.href = "/?page=login";
        return;
    }

    const params = new URLSearchParams(
        window.location.search
    );

    const checklistId = params.get("checklist");

    let groups = [];
    let activeGroup = null;
    let members = [];
    let expenses = [];

    main.innerHTML = layout(`
        <section class="section">

            <div class="section-title">
                <div>
                    <span class="badge">💰 Expenses</span>
                    <h2>Trip Expenses</h2>
                    <p style="color:var(--muted)">
                        Split travel expenses with your group.
                    </p>
                </div>

                <button
                    class="btn"
                    id="createGroupBtn"
                >
                    + Create Group
                </button>
            </div>

            <div id="expenseContent">
                <div class="empty">
                    Loading expense groups...
                </div>
            </div>

        </section>

        <!-- GROUP MODAL -->

        <div
            id="groupModal"
            style="
                display:none;
                position:fixed;
                inset:0;
                background:rgba(0,0,0,.45);
                z-index:1000;
                padding:20px;
                overflow:auto;
            "
        >

            <div
                class="form-card"
                style="margin:40px auto"
            >

                <h2>Create Expense Group</h2>

                <p style="color:var(--muted)">
                    Create a group for your trip expenses.
                </p>

                <form id="groupForm">

                    <div class="form-group">

                        <label>
                            Group name
                        </label>

                        <input
                            id="groupName"
                            required
                            placeholder="Ladakh Trip"
                        >

                    </div>

                    <div class="form-group">

                        <label>
                            Description
                        </label>

                        <textarea
                            id="groupDescription"
                            placeholder="Expenses for our Ladakh trip"
                        ></textarea>

                    </div>

                    <div
                        style="
                            display:flex;
                            gap:10px;
                        "
                    >

                        <button
                            class="btn"
                            type="submit"
                        >
                            Create Group
                        </button>

                        <button
                            type="button"
                            class="btn secondary"
                            id="closeGroupBtn"
                        >
                            Cancel
                        </button>

                    </div>

                </form>

            </div>

        </div>

        <!-- MEMBER MODAL -->

        <div
            id="memberModal"
            style="
                display:none;
                position:fixed;
                inset:0;
                background:rgba(0,0,0,.45);
                z-index:1000;
                padding:20px;
                overflow:auto;
            "
        >

            <div
                class="form-card"
                style="margin:40px auto"
            >

                <h2>Add Person</h2>

                <form id="memberForm">

                    <div class="form-group">

                        <label>
                            Name
                        </label>

                        <input
                            id="memberName"
                            required
                            placeholder="Rahul"
                        >

                    </div>

                    <div class="form-group">

                        <label>
                            Email
                        </label>

                        <input
                            id="memberEmail"
                            type="email"
                            placeholder="rahul@example.com"
                        >

                    </div>

                    <div
                        style="
                            display:flex;
                            gap:10px;
                        "
                    >

                        <button
                            class="btn"
                            type="submit"
                        >
                            Add Person
                        </button>

                        <button
                            type="button"
                            class="btn secondary"
                            id="closeMemberBtn"
                        >
                            Cancel
                        </button>

                    </div>

                </form>

            </div>

        </div>

        <!-- EXPENSE MODAL -->

        <div
            id="expenseModal"
            style="
                display:none;
                position:fixed;
                inset:0;
                background:rgba(0,0,0,.45);
                z-index:1000;
                padding:20px;
                overflow:auto;
            "
        >

            <div
                class="form-card"
                style="margin:40px auto"
            >

                <h2>Add Expense</h2>

                <form id="expenseForm">

                    <div class="form-group">

                        <label>
                            Expense name
                        </label>

                        <input
                            id="expenseName"
                            required
                            placeholder="Water Bottle"
                        >

                    </div>

                    <div class="form-group">

                        <label>
                            Amount
                        </label>

                        <input
                            id="expenseAmount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            placeholder="500"
                        >

                    </div>

                    <div class="form-group">

                        <label>
                            Paid by
                        </label>

                        <select
                            id="expensePaidBy"
                            required
                        ></select>

                    </div>

                    <div class="form-group">

                        <label>
                            Split type
                        </label>

                        <select id="splitType">

                            <option value="equal">
                                ⚖️ Split equally
                            </option>

                            <option value="custom">
                                ✏️ Custom split
                            </option>

                        </select>

                    </div>

                    <div class="form-group">

                        <label>
                            Split between
                        </label>

                        <div id="expenseMembers"></div>

                    </div>

                    <div
                        id="customSplitArea"
                        style="display:none"
                    >

                        <label>
                            Custom amounts
                        </label>

                        <div id="customAmounts"></div>

                    </div>

                    <br>

                    <div
                        style="
                            display:flex;
                            gap:10px;
                        "
                    >

                        <button
                            class="btn"
                            type="submit"
                        >
                            Add Expense
                        </button>

                        <button
                            type="button"
                            class="btn secondary"
                            id="closeExpenseBtn"
                        >
                            Cancel
                        </button>

                    </div>

                </form>

            </div>

        </div>
    `);


    // ============================================
    // LOAD GROUPS
    // ============================================

    async function loadGroups() {

        const { data, error } = await db
            .from("expense_groups")
            .select("*")
            .eq(
                "owner_id",
                currentSession.user.id
            )
            .order(
                "created_at",
                { ascending: false }
            );

        if (error) {
            throw error;
        }

        groups = data || [];

        renderGroups();
    }


    // ============================================
    // RENDER GROUPS
    // ============================================

    function renderGroups() {

        const container =
            document.getElementById(
                "expenseContent"
            );

        if (!groups.length) {

            container.innerHTML = `

                <div class="empty">

                    <h3>
                        No expense groups yet
                    </h3>

                    <p>
                        Create a group for your trip
                        and start splitting expenses.
                    </p>

                    <button
                        class="btn"
                        id="emptyCreateGroup"
                    >
                        + Create Expense Group
                    </button>

                </div>

            `;

            document.getElementById(
                "emptyCreateGroup"
            ).onclick = openGroupModal;

            return;
        }


        container.innerHTML = `

            <div class="grid">

                ${groups.map(group => `

                    <div class="card">

                        <span class="badge">
                            💰 Expense Group
                        </span>

                        <h3>
                            ${escapeHtml(group.name)}
                        </h3>

                        <p>
                            ${escapeHtml(
                                group.description || ""
                            )}
                        </p>

                        <button
                            class="btn"
                            data-group="${group.id}"
                            class="open-group"
                        >
                            Open Group
                        </button>

                    </div>

                `).join("")}

            </div>

        `;


        container
            .querySelectorAll(
                "[data-group]"
            )
            .forEach(button => {

                button.onclick = () => {

                    openGroup(
                        button.dataset.group
                    );

                };

            });

    }


    // ============================================
    // CREATE GROUP MODAL
    // ============================================

    function openGroupModal() {

        document.getElementById(
            "groupModal"
        ).style.display = "block";

    }


    function closeGroupModal() {

        document.getElementById(
            "groupModal"
        ).style.display = "none";

    }


    document.getElementById(
        "createGroupBtn"
    ).onclick = openGroupModal;


    document.getElementById(
        "closeGroupBtn"
    ).onclick = closeGroupModal;


    // ============================================
    // CREATE GROUP
    // ============================================

    document.getElementById(
        "groupForm"
    ).onsubmit = async event => {

        event.preventDefault();

        const name =
            document.getElementById(
                "groupName"
            ).value.trim();

        const description =
            document.getElementById(
                "groupDescription"
            ).value.trim();


        const { data, error } = await db
            .from("expense_groups")
            .insert({

                owner_id:
                    currentSession.user.id,

                checklist_id:
                    checklistId || null,

                name,

                description

            })
            .select()
            .single();


        if (error) {

            showToast(error.message);

            return;

        }


        /*
         * Add owner automatically
         * as first member.
         */

        const { error: memberError } =
            await db
                .from("expense_members")
                .insert({

                    group_id: data.id,

                    name: "Me",

                    email:
                        currentSession.user.email,

                    user_id:
                        currentSession.user.id

                });


        if (memberError) {

            showToast(
                memberError.message
            );

            return;

        }


        closeGroupModal();

        showToast(
            "Expense group created!"
        );

        await loadGroups();

        openGroup(data.id);

    };


    // ============================================
    // OPEN GROUP
    // ============================================

    async function openGroup(groupId) {

        activeGroup =
            groups.find(
                group =>
                    group.id === groupId
            );


        if (!activeGroup) {

            const { data, error } =
                await db
                    .from("expense_groups")
                    .select("*")
                    .eq("id", groupId)
                    .single();

            if (error) {

                showToast(
                    error.message
                );

                return;

            }

            activeGroup = data;

        }


        await loadMembers();

        await loadExpenses();

        renderGroup();

    }


    // ============================================
    // MEMBERS
    // ============================================

    async function loadMembers() {

        const { data, error } =
            await db
                .from("expense_members")
                .select("*")
                .eq(
                    "group_id",
                    activeGroup.id
                )
                .order("created_at");


        if (error) {

            showToast(
                error.message
            );

            return;

        }

        members = data || [];

    }


    async function addMember() {

        document.getElementById(
            "memberModal"
        ).style.display = "block";

    }


    document.getElementById(
        "closeMemberBtn"
    ).onclick = () => {

        document.getElementById(
            "memberModal"
        ).style.display = "none";

    };


    document.getElementById(
        "memberForm"
    ).onsubmit = async event => {

        event.preventDefault();


        const name =
            document.getElementById(
                "memberName"
            ).value.trim();

        const email =
            document.getElementById(
                "memberEmail"
            ).value.trim();


        const { error } =
            await db
                .from("expense_members")
                .insert({

                    group_id:
                        activeGroup.id,

                    name,

                    email:
                        email || null

                });


        if (error) {

            showToast(
                error.message
            );

            return;

        }


        document.getElementById(
            "memberForm"
        ).reset();


        document.getElementById(
            "memberModal"
        ).style.display = "none";


        await loadMembers();

        renderGroup();

        showToast(
            `${name} added!`
        );

    };


    // ============================================
    // DELETE MEMBER
    // ============================================

    async function deleteMember(memberId) {

        if (
            !confirm(
                "Remove this person from the group?"
            )
        ) {
            return;
        }


        const { error } =
            await db
                .from("expense_members")
                .delete()
                .eq(
                    "id",
                    memberId
                );


        if (error) {

            showToast(
                error.message
            );

            return;

        }


        await loadMembers();

        await loadExpenses();

        renderGroup();

    }


    // ============================================
    // LOAD EXPENSES
    // ============================================

    async function loadExpenses() {

        const { data, error } =
            await db
                .from("expenses")
                .select(`
                    *,
                    expense_splits(*)
                `)
                .eq(
                    "group_id",
                    activeGroup.id
                )
                .order(
                    "created_at",
                    { ascending: false }
                );


        if (error) {

            showToast(
                error.message
            );

            return;

        }


        expenses = data || [];

    }


    // ============================================
    // RENDER GROUP
    // ============================================

    function renderGroup() {

        const container =
            document.getElementById(
                "expenseContent"
            );


        container.innerHTML = `

            <div>

                <button
                    class="btn secondary"
                    id="backGroups"
                >
                    ← Groups
                </button>

                <div
                    class="card"
                    style="margin-top:20px"
                >

                    <span class="badge">
                        💰 Expense Group
                    </span>

                    <h2>
                        ${escapeHtml(
                            activeGroup.name
                        )}
                    </h2>

                    <p>
                        ${escapeHtml(
                            activeGroup.description || ""
                        )}
                    </p>

                </div>


                <!-- PEOPLE -->

                <div
                    class="card"
                    style="margin-top:18px"
                >

                    <div class="section-title">

                        <h3>
                            👥 People
                        </h3>

                        <button
                            class="btn"
                            id="addPersonBtn"
                        >
                            + Add Person
                        </button>

                    </div>

                    ${members.map(
                        member => `

                        <div
                            class="item"
                        >

                            <div style="flex:1">

                                <strong>
                                    ${escapeHtml(
                                        member.name
                                    )}
                                </strong>

                                <br>

                                <span
                                    style="
                                        color:var(--muted)
                                    "
                                >
                                    ${escapeHtml(
                                        member.email || ""
                                    )}
                                </span>

                            </div>

                            ${
                                member.user_id !==
                                currentSession.user.id
                                    ? `
                                    <button
                                        class="btn danger remove-member"
                                        data-id="${member.id}"
                                    >
                                        Remove
                                    </button>
                                    `
                                    : ""
                            }

                        </div>

                    `
                    ).join("")}

                </div>


                <!-- EXPENSES -->

                <div
                    class="card"
                    style="margin-top:18px"
                >

                    <div class="section-title">

                        <h3>
                            💸 Expenses
                        </h3>

                        <button
                            class="btn"
                            id="addExpenseButton"
                        >
                            + Add Expense
                        </button>

                    </div>


                    ${
                        expenses.length
                            ? expenses.map(
                                expense => {

                                    const payer =
                                        members.find(
                                            member =>
                                                member.id ===
                                                expense.paid_by
                                        );


                                    return `

                                        <div
                                            class="item"
                                        >

                                            <div
                                                style="flex:1"
                                            >

                                                <strong>
                                                    ${escapeHtml(
                                                        expense.description
                                                    )}
                                                </strong>

                                                <br>

                                                <span
                                                    style="
                                                        color:var(--muted)
                                                    "
                                                >
                                                    Paid by
                                                    ${escapeHtml(
                                                        payer?.name ||
                                                        "Unknown"
                                                    )}
                                                </span>

                                            </div>

                                            <strong>
                                                ₹${Number(
                                                    expense.amount
                                                ).toFixed(2)}
                                            </strong>

                                        </div>

                                    `;

                                }
                            ).join("")
                            : `
                                <div class="empty">
                                    No expenses yet.
                                </div>
                            `
                    }

                </div>


                <!-- BALANCES -->

                <div
                    class="card"
                    style="margin-top:18px"
                >

                    <h3>
                        📊 Balances
                    </h3>

                    <div id="balances">
                        Calculating...
                    </div>

                </div>

            </div>

        `;


        document.getElementById(
            "backGroups"
        ).onclick = () => {

            activeGroup = null;

            renderGroups();

        };


        document.getElementById(
            "addPersonBtn"
        ).onclick = addMember;


        document.getElementById(
            "addExpenseButton"
        ).onclick = openExpenseModal;


        document
            .querySelectorAll(
                ".remove-member"
            )
            .forEach(button => {

                button.onclick = () => {

                    deleteMember(
                        button.dataset.id
                    );

                };

            });


        renderBalances();

    }


    // ============================================
    // EXPENSE MODAL
    // ============================================

    function openExpenseModal() {

        if (members.length < 1) {

            showToast(
                "Add at least one person first."
            );

            return;

        }


        const paidBy =
            document.getElementById(
                "expensePaidBy"
            );


        paidBy.innerHTML =
            members.map(
                member => `

                    <option
                        value="${member.id}"
                    >
                        ${escapeHtml(
                            member.name
                        )}
                    </option>

                `
            ).join("");


        renderExpenseMembers();


        document.getElementById(
            "expenseModal"
        ).style.display = "block";

    }


    document.getElementById(
        "closeExpenseBtn"
    ).onclick = () => {

        document.getElementById(
            "expenseModal"
        ).style.display = "none";

    };


    // ============================================
    // SPLIT MEMBERS
    // ============================================

    function renderExpenseMembers() {

        const container =
            document.getElementById(
                "expenseMembers"
            );


        container.innerHTML =
            members.map(
                member => `

                    <label
                        style="
                            display:flex;
                            gap:10px;
                            padding:8px 0;
                        "
                    >

                        <input
                            type="checkbox"
                            class="expense-member"
                            value="${member.id}"
                            checked
                        >

                        <span>
                            ${escapeHtml(
                                member.name
                            )}
                        </span>

                    </label>

                `
            ).join("");

    }


    document.getElementById(
        "splitType"
    ).onchange = event => {

        const custom =
            event.target.value === "custom";


        document.getElementById(
            "customSplitArea"
        ).style.display =
            custom
                ? "block"
                : "none";


        if (custom) {

            renderCustomAmounts();

        }

    };


    function renderCustomAmounts() {

        const container =
            document.getElementById(
                "customAmounts"
            );


        const selected =
            [
                ...document.querySelectorAll(
                    ".expense-member:checked"
                )
            ];


        container.innerHTML =
            selected.map(
                checkbox => {

                    const member =
                        members.find(
                            m =>
                                m.id ===
                                checkbox.value
                        );


                    return `

                        <div
                            class="form-group"
                        >

                            <label>
                                ${escapeHtml(
                                    member.name
                                )}
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                class="custom-amount"
                                data-member="${member.id}"
                                placeholder="0"
                            >

                        </div>

                    `;

                }
            ).join("");

    }


    // ============================================
    // ADD EXPENSE
    // ============================================

    document.getElementById(
        "expenseForm"
    ).onsubmit = async event => {

        event.preventDefault();


        const description =
            document.getElementById(
                "expenseName"
            ).value.trim();


        const amount =
            Number(
                document.getElementById(
                    "expenseAmount"
                ).value
            );


        const paidBy =
            document.getElementById(
                "expensePaidBy"
            ).value;


        const splitType =
            document.getElementById(
                "splitType"
            ).value;


        const selected =
            [
                ...document.querySelectorAll(
                    ".expense-member:checked"
                )
            ].map(
                checkbox =>
                    checkbox.value
            );


        if (!selected.length) {

            showToast(
                "Select at least one person."
            );

            return;

        }


        let splits = [];


        if (splitType === "equal") {

            const share =
                amount / selected.length;


            splits =
                selected.map(
                    memberId => ({

                        member_id:
                            memberId,

                        amount:
                            Number(
                                share.toFixed(2)
                            )

                    })
                );

        } else {

            const inputs =
                [
                    ...document.querySelectorAll(
                        ".custom-amount"
                    )
                ];


            splits =
                inputs.map(
                    input => ({

                        member_id:
                            input.dataset.member,

                        amount:
                            Number(
                                input.value || 0
                            )

                    })
                );


            const total =
                splits.reduce(
                    (sum, split) =>
                        sum + split.amount,
                    0
                );


            if (
                Math.abs(
                    total - amount
                ) > 0.01
            ) {

                showToast(
                    `Custom split must equal ₹${amount.toFixed(2)}`
                );

                return;

            }

        }


        const { data: expense, error } =
            await db
                .from("expenses")
                .insert({

                    group_id:
                        activeGroup.id,

                    description,

                    amount,

                    paid_by:
                        paidBy,

                    split_type:
                        splitType

                })
                .select()
                .single();


        if (error) {

            showToast(
                error.message
            );

            return;

        }


        const splitRows =
            splits.map(
                split => ({

                    expense_id:
                        expense.id,

                    member_id:
                        split.member_id,

                    amount:
                        split.amount

                })
            );


        const { error: splitError } =
            await db
                .from("expense_splits")
                .insert(splitRows);


        if (splitError) {

            showToast(
                splitError.message
            );

            return;

        }


        document.getElementById(
            "expenseForm"
        ).reset();


        document.getElementById(
            "expenseModal"
        ).style.display = "none";


        await loadExpenses();

        renderGroup();


        showToast(
            "Expense added successfully!"
        );

    };


    // ============================================
    // BALANCES
    // ============================================

    async function renderBalances() {

        const container =
            document.getElementById(
                "balances"
            );


        if (!container) {
            return;
        }


        const balances = {};


        members.forEach(
            member => {

                balances[member.id] = 0;

            }
        );


        expenses.forEach(
            expense => {

                /*
                 * Person who paid gets credit.
                 */

                balances[
                    expense.paid_by
                ] += Number(
                    expense.amount
                );


                /*
                 * Every split participant
                 * owes their split amount.
                 */

                expense.expense_splits?.forEach(
                    split => {

                        balances[
                            split.member_id
                        ] -= Number(
                            split.amount
                        );

                    }
                );

            }
        );


        container.innerHTML =
            members.map(
                member => {

                    const balance =
                        balances[
                            member.id
                        ] || 0;


                    if (
                        Math.abs(balance)
                        < 0.01
                    ) {

                        return `

                            <div class="item">

                                <span>
                                    ${escapeHtml(
                                        member.name
                                    )}
                                </span>

                                <strong>
                                    Settled ✓
                                </strong>

                            </div>

                        `;

                    }


                    if (balance > 0) {

                        return `

                            <div class="item">

                                <span>
                                    ${escapeHtml(
                                        member.name
                                    )}
                                </span>

                                <strong
                                    style="
                                        color:var(--success)
                                    "
                                >
                                    Gets ₹${balance.toFixed(2)}
                                </strong>

                            </div>

                        `;

                    }


                    return `

                        <div class="item">

                            <span>
                                ${escapeHtml(
                                    member.name
                                )}
                            </span>

                            <strong
                                style="
                                    color:var(--danger)
                                "
                            >
                                Owes ₹${Math.abs(
                                    balance
                                ).toFixed(2)}
                            </strong>

                        </div>

                    `;

                }
            ).join("");

    }


    // ============================================
    // START
    // ============================================

    try {

        await loadGroups();

    } catch (error) {

        console.error(error);

        document.getElementById(
            "expenseContent"
        ).innerHTML = `

            <div class="empty">

                <h3>
                    Something went wrong
                </h3>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>

        `;

    }

}



// async function checklistPage(slug) {

//     await refreshNav();

//     try {

//         const list = await fetchChecklist(slug);

//         if (!list) {
//             main.innerHTML = layout(`
//         <div class="empty">
//           <h2>Checklist not found</h2>
//           <p>This checklist may have been deleted.</p>
//         </div>
//       `);
//             return;
//         }

//         if (list.has_password) {
//             await protectedChecklistPage(slug, list);
//             return;
//         }

//         if (!list.is_public) {

//             if (
//                 !currentSession ||
//                 currentSession.user.id !== list.owner_id
//             ) {
//                 main.innerHTML = `
//           <div class="lock-card">
//             <div class="lock-icon">🔒</div>
//             <h2>Private checklist</h2>
//             <p>Only the owner can access this checklist.</p>
//           </div>
//         `;

//                 return;
//             }
//         }

//         const categories =
//             await loadPublicChecklist(list);

//         renderChecklist(list, categories);

//     } catch (error) {

//         console.error(error);

//         main.innerHTML = `
//       <div class="empty">
//         <h2>Something went wrong</h2>
//         <p>${escapeHtml(error.message)}</p>
//       </div>
//     `;
//     }
// }
async function checklistPage(slug) {

    await refreshNav();

    try {

        // First try the normal Supabase query
        let list = await fetchChecklist(slug);

        // If Supabase RLS prevents an anonymous visitor
        // from seeing the protected checklist, get its
        // basic information through the Netlify function.
        if (!list) {
            try {
                list = await fetchProtectedChecklist(slug);
            } catch (error) {
                console.error(
                    "Protected checklist lookup failed:",
                    error
                );
            }
        }

        if (!list) {
            main.innerHTML = layout(`
                <div class="empty">
                    <h2>Checklist not found</h2>
                    <p>This checklist may have been deleted.</p>
                </div>
            `);

            return;
        }

        // Password protected
        if (list.has_password) {
            await protectedChecklistPage(
                slug,
                list
            );

            return;
        }

        // Private checklist
        if (!list.is_public) {

            if (
                !currentSession ||
                currentSession.user.id !== list.owner_id
            ) {
                main.innerHTML = `
                    <div class="lock-card">
                        <div class="lock-icon">🔒</div>

                        <h2>Private checklist</h2>

                        <p>
                            Only the owner can access this checklist.
                        </p>
                    </div>
                `;

                return;
            }
        }

        const categories =
            await loadPublicChecklist(list);

        renderChecklist(
            list,
            categories
        );

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
    if (page === "expenses") {
    await expensesPage();
    return;
}   

    await homePage();
}

db.auth.onAuthStateChange(() => {
    setTimeout(() => refreshNav(), 0);
});

router();