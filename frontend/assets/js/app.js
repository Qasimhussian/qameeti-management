
const API = "/api";

let committees = [];
let currentCommittee = null;
let wheelRotation = 0;
let eligibleCommitteeMembers = [];
let drawCanFull = false;
let drawCanMonthly = false;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;

  if (response.status === 401) showLogin();

  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }

  return data;
}

function toast(message) {
  $("#toastMessage").textContent = message;
  bootstrap.Toast.getOrCreateInstance($("#appToast")).show();
}

function showLogin() {
  $("#appView").classList.add("d-none");
  $("#loginView").classList.remove("d-none");
}

function showApp(username) {
  $("#loginView").classList.add("d-none");
  $("#appView").classList.remove("d-none");
  $("#adminName").textContent = username || "Admin";
}

function navigate(page) {
  $$(".page-section").forEach(el => el.classList.add("d-none"));

  const target = $("#page-" + page);
  if (target) target.classList.remove("d-none");

  $$(".sidebar .nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  const labels = {
    dashboard: "Dashboard",
    committees: "Committees",
    create: "Create committee",
    detail: "Committee details",
    draw: "Draw center",
    history: "Draw history"
  };

  $("#pageHeading").textContent = labels[page] || "Qameeti";
  $("#sidebar").classList.remove("open");

  if (page === "dashboard" || page === "committees") loadCommittees();

  if (page === "draw" || page === "history") {
    populateCommitteeSelects();
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function moneylessStatus(status) {
  const map = {
    draft: "Draft",
    active: "Active",
    completed: "Completed",
    archived: "Archived"
  };

  return map[status] || status;
}

// Pakistan time ke mutabiq next month ki pehli tareekh.
function getNextPakistanMonthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month),
      1
    ) - 5 * 60 * 60 * 1000
  );
}

function formatPakistanDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

async function loadCommittees() {
  try {
    const data = await api("/committees");

    committees = data.committees;

    const totalMembers = committees.reduce(
      (a, c) => a + c.memberCount,
      0
    );

    const completed = committees.reduce(
      (a, c) => a + c.completedMonths,
      0
    );

    const pending = committees.reduce(
      (a, c) => a + Math.max(0, c.totalMonths - c.completedMonths),
      0
    );

    $("#statCommittees").textContent = committees.length;
    $("#statMembers").textContent = totalMembers;
    $("#statCompleted").textContent = completed;
    $("#statPending").textContent = pending;

    renderCommitteeTables();
  } catch (e) {
    toast(e.message);
  }
}

function renderCommitteeTables() {
  const rows = committees.map(c => `
    <tr>
      <td>
        <strong>${escapeHtml(c.name)}</strong>
        <div class="small text-secondary">
          ${escapeHtml(c.drawMethod === "full" ? "Full draw" : "Monthly draw")}
        </div>
      </td>
      <td>${c.memberCount} / ${c.totalMembers}</td>
      <td>${c.completedMonths} / ${c.totalMonths}</td>
      <td><span class="badge-soft">${moneylessStatus(c.status)}</span></td>
      <td>
        <button class="btn btn-sm btn-light" data-open="${c._id}">
          Manage <i class="bi bi-arrow-up-right ms-1"></i>
        </button>
      </td>
    </tr>
  `).join("");

  const table = `
    <table class="table">
      <thead>
        <tr>
          <th>Committee</th>
          <th>Members</th>
          <th>Months assigned</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows || ""}</tbody>
    </table>
  `;

  $("#dashboardCommittees").innerHTML = rows
    ? table
    : `<div class="empty-state"><i class="bi bi-collection"></i>No committees yet. Create your first committee.</div>`;

  $("#committeeGrid").innerHTML = committees.length
    ? committees.map(c => `
      <div class="col-md-6 col-xl-4">
        <div class="committee-card">
          <div class="d-flex justify-content-between">
            <span class="card-icon"><i class="bi bi-people"></i></span>
            <span class="badge-soft">${moneylessStatus(c.status)}</span>
          </div>

          <h3>${escapeHtml(c.name)}</h3>
          <p class="text-secondary small">
            ${escapeHtml(c.description || "No description added.")}
          </p>

          <div class="d-flex gap-4 mt-3">
            <div>
              <div class="mini-stat">Members</div>
              <strong>${c.memberCount}/${c.totalMembers}</strong>
            </div>
            <div>
              <div class="mini-stat">Months</div>
              <strong>${c.completedMonths}/${c.totalMonths}</strong>
            </div>
          </div>

          <button class="btn btn-outline-primary w-100 mt-4" data-open="${c._id}">
            Open committee <i class="bi bi-arrow-right ms-1"></i>
          </button>
          ${c.status === "completed" ? `
            <button class="btn btn-outline-danger w-100 mt-2" data-delete-committee="${c._id}">
              <i class="bi bi-trash me-2"></i>Delete completed committee
            </button>
          ` : ""}
        </div>
      </div>
    `).join("")
    : `<div class="col-12"><div class="panel empty-state"><i class="bi bi-collection"></i>No committees created yet.</div></div>`;
}

function showCreate() {
  $("#committeeForm").reset();
  $("#monthInputs").innerHTML = "";
  $("#monthCount").textContent = "0 months";
  $("#committeeError").classList.add("d-none");

  navigate("create");
}

function buildMonthInputs(count) {
  const wrap = $("#monthInputs");
  wrap.innerHTML = "";

  const safe = Math.min(Math.max(Number(count) || 0, 0), 120);

  $("#monthCount").textContent =
    `${safe} month${safe === 1 ? "" : "s"}`;

  for (let i = 1; i <= safe; i++) {
    wrap.insertAdjacentHTML("beforeend", `
      <div class="col-sm-6 col-lg-4">
        <label class="form-label small">Month ${i}</label>
        <input
          class="form-control month-name"
          required
          maxlength="40"
          placeholder="e.g. January"
        >
      </div>
    `);
  }
}

async function createCommittee(e) {
  e.preventDefault();

  const f = new FormData(e.currentTarget);

  const months = $$(".month-name").map((el, i) => ({
    name: el.value.trim(),
    order: i + 1
  }));

  const payload = {
    name: f.get("name"),
    description: f.get("description"),
    totalMembers: Number(f.get("totalMembers")),
    totalMonths: Number(f.get("totalMonths")),
    startDate: f.get("startDate"),
    drawMethod: f.get("drawMethod"),
    months
  };

  try {
    const data = await api("/committees", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    toast("Committee created. Now add its members.");

    await openCommittee(data.committee._id);
  } catch (err) {
    $("#committeeError").textContent = err.message;
    $("#committeeError").classList.remove("d-none");
  }
}

async function openCommittee(id) {
  try {
    const data = await api(`/committees/${id}`);

    currentCommittee = data;

    const c = data.committee;

    const memberRows = data.members.map(cm => `
      <tr>
        <td>${escapeHtml(cm.memberId?.fullName || "Unknown")}</td>
        <td>${escapeHtml(cm.memberId?.phone || "—")}</td>
        <td><span class="badge-soft">${cm.status}</span></td>
      </tr>
    `).join("");

    const resultRows = data.results.map(r => `
      <tr>
        <td>${r.monthOrder}. ${escapeHtml(r.monthName)}</td>
        <td>${escapeHtml(r.committeeMemberId?.memberId?.fullName || "Unknown")}</td>
      </tr>
    `).join("");

    $("#committeeDetail").innerHTML = `
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div class="eyebrow">COMMITTEE</div>
          <h1 class="page-title">${escapeHtml(c.name)}</h1>
          <p class="text-secondary">
            ${escapeHtml(c.description || "Committee overview and members.")}
          </p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-primary" data-go-draw="${c._id}">
            <i class="bi bi-shuffle me-2"></i>Open draw center
          </button>
          ${c.status === "completed" ? `
            <button class="btn btn-outline-danger" data-delete-committee="${c._id}">
              <i class="bi bi-trash me-2"></i>Delete committee
            </button>
          ` : ""}
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-label">Members</div>
            <div class="stat-value">${data.members.length}/${c.totalMembers}</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-label">Draw months</div>
            <div class="stat-value">${data.results.length}/${c.totalMonths}</div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="stat-card">
            <div class="stat-label">Method</div>
            <div class="h4 mt-2">
              ${c.drawMethod === "full" ? "Full draw" : "Monthly draw"}
            </div>
          </div>
        </div>
      </div>

      <div class="panel mb-3">
        <div class="panel-head">
          <div>
            <h2 class="h5 mb-1">Add member</h2>
            <p class="small text-secondary mb-0">
              Add members before starting the draw.
            </p>
          </div>
        </div>

        ${c.methodLocked
          ? `<div class="alert alert-info mb-0">Draw has started. Member list is locked.</div>`
          : `
            <form id="addMemberForm" class="row g-2">
              <div class="col-md-4">
                <input name="fullName" class="form-control" placeholder="Full name" required>
              </div>
              <div class="col-md-3">
                <input name="phone" class="form-control" placeholder="Phone number">
              </div>
              <div class="col-md-3">
                <input name="address" class="form-control" placeholder="Address">
              </div>
              <div class="col-md-2">
                <button class="btn btn-primary w-100">Add member</button>
              </div>
            </form>
          `
        }
      </div>

      <div class="panel mb-3">
        <div class="panel-head">
          <h2 class="h5 mb-0">Members</h2>
          <span class="badge-soft">${data.members.length} added</span>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${memberRows || `<tr><td colspan="3" class="text-secondary">No members added yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2 class="h5 mb-0">Assigned months & winners</h2>
          <button class="btn btn-sm btn-outline-primary" data-pdf="${c._id}">
            Export PDF
          </button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead><tr><th>Month</th><th>Winner</th></tr></thead>
            <tbody>
              ${resultRows || `<tr><td colspan="2" class="text-secondary">No draw results yet.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    navigate("detail");

    const form = $("#addMemberForm");

    if (form) {
      form.addEventListener("submit", addMember);
    }
  } catch (e) {
    toast(e.message);
  }
}

async function addMember(e) {
  e.preventDefault();

  const f = new FormData(e.currentTarget);

  try {
    await api(`/committees/${currentCommittee.committee._id}/members`, {
      method: "POST",
      body: JSON.stringify({
        fullName: f.get("fullName"),
        phone: f.get("phone"),
        address: f.get("address")
      })
    });

    toast("Member added successfully.");

    await openCommittee(currentCommittee.committee._id);
  } catch (err) {
    toast(err.message);
  }
}

async function deleteCommittee(id) {
  const committee = committees.find(c => String(c._id) === String(id));
  const committeeName = committee?.name || currentCommittee?.committee?.name || "this committee";

  if (!confirm(
    `Delete completed committee "${committeeName}"?\n\nDraw history and saved results will be kept. This action cannot be undone.`
  )) return;

  try {
    await api(`/committees/${id}`, {
      method: "DELETE"
    });

    if (String(currentCommittee?.committee?._id) === String(id)) {
      currentCommittee = null;
    }

    toast("Committee deleted. Draw history and results have been kept.");
    await loadCommittees();
    navigate("committees");
  } catch (err) {
    toast(err.message);
  }
}

async function populateCommitteeSelects() {
  await loadCommittees();

  const options = `
    <option value="">Choose a committee...</option>
    ${committees.map(c => `
      <option value="${c._id}">${escapeHtml(c.name)}</option>
    `).join("")}
  `;

  if ($("#drawCommitteeSelect")) {
    $("#drawCommitteeSelect").innerHTML = options;
  }

  if ($("#historyCommittee")) {
    $("#historyCommittee").innerHTML = options;
  }
}

async function selectDrawCommittee(id) {
  const c = committees.find(x => x._id === id);

  currentCommittee = null;

  $("#drawWorkspace").classList.add("d-none");

  drawCanFull = false;
  drawCanMonthly = false;

  if (!c) return;

  const data = await api(`/committees/${id}`);

  currentCommittee = data;


  const committee = data.committee;

  const doneIds = new Set(
    data.results.map(r => String(r.monthId))
  );

  const pending = committee.months
    .filter(m => !doneIds.has(String(m._id)))
    .sort((a, b) => a.order - b.order);

  const winners = new Set(
    data.results.map(r => String(r.committeeMemberId?._id))
  );

  eligibleCommitteeMembers = data.members.filter(
    m => !winners.has(String(m._id))
  );

  $("#drawCommitteeInfo").textContent =
    `${data.members.length}/${committee.totalMembers} members · ` +
    `${data.results.length}/${committee.totalMonths} months assigned · ` +
    `${committee.drawMethod} draw`;

  $("#pendingMonth").innerHTML = pending.map(m => `
    <option value="${m._id}">
      ${m.order}. ${escapeHtml(m.name)}
    </option>
  `).join("") || `<option value="">All months completed</option>`;

  // Latest result ki date se next Pakistan month start calculate karo.
  const latestDraw = data.results
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  let monthlyLocked = false;
  let unlockDate = null;

  if (committee.drawMethod === "monthly" && latestDraw) {
    unlockDate = getNextPakistanMonthStart(
      new Date(latestDraw.createdAt)
    );

    monthlyLocked = Date.now() < unlockDate.getTime();
  }

  drawCanFull =
    committee.drawMethod === "full" &&
    data.results.length === 0 &&
    data.members.length === committee.totalMembers;

  drawCanMonthly =
    committee.drawMethod === "monthly" &&
    !monthlyLocked &&
    pending.length > 0 &&
    data.members.length === committee.totalMembers;

  $("#fullDrawBtn").disabled = !drawCanFull;
  $("#monthlyDrawBtn").disabled = !drawCanMonthly;

  $("#fullDrawBtn").title = !drawCanFull
    ? "Full draw is unavailable for this committee."
    : "";

  $("#monthlyDrawBtn").title = monthlyLocked
    ? `Locked until ${formatPakistanDate(unlockDate)}`
    : !drawCanMonthly
      ? "Monthly draw is unavailable for this committee."
      : "";

  $("#drawError").classList.add("d-none");
  $("#winnerCard").classList.add("d-none");

  if (monthlyLocked) {
    $("#drawStatus").textContent =
      `Monthly committee locked. Unlocks on ${formatPakistanDate(unlockDate)} (Pakistan time).`;
  } else {
    $("#drawStatus").textContent = "Ready when you are.";
  }

  $("#drawWorkspace").classList.remove("d-none");

  const wheelMembers = committee.drawMethod === "monthly"
    ? eligibleCommitteeMembers
    : data.members;

  drawWheel(
    wheelMembers.map(m => m.memberId?.fullName || "Member")
  );
}

function drawWheel(names) {
  const canvas = $("#wheelCanvas");
  const ctx = canvas.getContext("2d");

  wheelRotation = 0;

  canvas.style.transition = "none";
  canvas.style.transform = "rotate(0deg)";

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 225;

  ctx.clearRect(0, 0, 480, 480);

  if (!names.length) {
    names = ["Add members first"];
  }

  const slice = Math.PI * 2 / names.length;

  const colors = [
    "#315efb",
    "#13a77a",
    "#f0a43b",
    "#8b63dc",
    "#e15d78",
    "#2296b7",
    "#53657f",
    "#d17c43"
  ];

  names.forEach((name, i) => {
    const start = -Math.PI / 2 + i * slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();

    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "600 13px DM Sans, sans-serif";

    const label = name.length > 18
      ? name.slice(0, 17) + "…"
      : name;

    ctx.fillText(label, radius - 20, 5);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 29, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

// Wheel animation complete hone ke baad Promise resolve hota hai.
function spinToWinner(names, winnerId, memberRecords) {
  return new Promise(resolve => {
    const index = memberRecords.findIndex(
      m => String(m._id) === String(winnerId)
    );

    const canvas = $("#wheelCanvas");

    const n = Math.max(names.length, 1);
    const slice = 360 / n;

    const target = index < 0
      ? 0
      : index * slice + slice / 2;

    const current = wheelRotation % 360;
    const desired = (360 - target) % 360;
    const delta = (desired - current + 360) % 360;

    wheelRotation += 360 * 5 + delta;

    canvas.style.transition = "none";
    canvas.style.transform = `rotate(${current}deg)`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas.style.transition =
          "transform 5s cubic-bezier(.12,.72,.13,1)";

        canvas.style.transform = `rotate(${wheelRotation}deg)`;

        setTimeout(resolve, 5100);
      });
    });
  });
}

async function runFullDraw() {
  if (!currentCommittee || !drawCanFull) return;

  if (!confirm(
    "Run the full draw now? The result will be saved and cannot be changed."
  )) return;

  const committeeId = currentCommittee.committee._id;

  setDrawBusy(true);
  $("#winnerCard").classList.add("d-none");

  try {
    const data = await api(`/draw/full/${committeeId}`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      },
      body: "{}"
    });

    const members = currentCommittee.members;
    const names = members.map(
      m => m.memberId?.fullName || "Member"
    );

    drawWheel(names);

    const first = data.results[0];

    const winner = members.find(
      m => String(m._id) === String(first.committeeMemberId)
    );

    $("#drawStatus").textContent = "Wheel is spinning...";

    if (winner) {
      await spinToWinner(names, winner._id, members);
    }

    $("#winnerName").textContent =
      winner?.memberId?.fullName || "Full draw completed";

    $("#winnerMonth").textContent =
      `${first.monthName} · ${data.results.length} total month assignments saved. Review the complete list in committee details.`;

    const heading = $(".winner-card .eyebrow");

    if (heading) {
      heading.textContent = "CONGRATULATIONS!";
    }

    $("#winnerCard").classList.remove("d-none");

    $("#drawStatus").textContent = "Full draw completed and saved.";

    drawCanFull = false;
    $("#fullDrawBtn").disabled = true;

    toast("Full committee draw completed.");
  } catch (e) {
    showDrawError(e.message);
  } finally {
    setDrawBusy(false);
  }
}

async function runMonthlyDraw() {
  if (!currentCommittee || !drawCanMonthly) return;

  const committeeId = currentCommittee.committee._id;
  const monthId = $("#pendingMonth").value;

  if (!monthId) return;

  const month = currentCommittee.committee.months.find(
    m => String(m._id) === monthId
  );

  if (!confirm(
    `Draw one winner for ${month?.name || "this month"}? The result will be saved and cannot be changed.`
  )) return;

  setDrawBusy(true);
  $("#winnerCard").classList.add("d-none");

  try {
    const data = await api(`/draw/monthly/${committeeId}`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({ monthId })
    });

    const eligible = [...eligibleCommitteeMembers];

    const winner = eligible.find(
      m => String(m._id) === String(data.result.committeeMemberId)
    );

    const name = winner?.memberId?.fullName || "Selected member";

    const names = eligible.map(
      m => m.memberId?.fullName || "Member"
    );

    drawWheel(names);

    $("#drawStatus").textContent = "Wheel is spinning...";

    // Winner ki details animation ke baad hi reveal hongi.
    await spinToWinner(
      names,
      data.result.committeeMemberId,
      eligible
    );

    $("#winnerName").textContent = name;

    $("#winnerMonth").textContent =
      `Selected month: ${data.result.monthName}`;

    const heading = $(".winner-card .eyebrow");

    if (heading) {
      heading.textContent = "CONGRATULATIONS!";
    }

    $("#winnerCard").classList.remove("d-none");

    // Agli Pakistan calendar month ki pehli tareekh.
    const unlockDate = getNextPakistanMonthStart();

    drawCanMonthly = false;
    $("#monthlyDrawBtn").disabled = true;

    $("#drawStatus").textContent =
      `Draw completed and saved. Monthly committee locked until ${formatPakistanDate(unlockDate)} (Pakistan time).`;

    toast(`${name} selected for ${data.result.monthName}.`);
  } catch (e) {
    showDrawError(e.message);
  } finally {
    setDrawBusy(false);
  }
}


  
function setDrawBusy(busy) {
  $("#fullDrawBtn").disabled = busy || !drawCanFull;
  $("#monthlyDrawBtn").disabled = busy || !drawCanMonthly;

  if (busy) {
    $("#drawStatus").textContent = "Processing secure draw...";
  }
}

function showDrawError(message) {
  $("#drawError").textContent = message;
  $("#drawError").classList.remove("d-none");
  $("#drawStatus").textContent = "Draw could not be completed.";
}

async function loadHistory(id) {
  if (!id) {
    $("#historyTable").innerHTML =
      `<div class="empty-state">Select a committee to view results.</div>`;
    return;
  }

  try {
    const data = await api(`/draw/history/${id}`);

    const rows = data.results.map(r => `
      <tr>
        <td>${r.monthOrder}. ${escapeHtml(r.monthName)}</td>
        <td>
          <strong>
            ${escapeHtml(r.committeeMemberId?.memberId?.fullName || "Unknown")}
          </strong>
        </td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
        <td><span class="badge-soft">Saved</span></td>
      </tr>
    `).join("");

    $("#historyTable").innerHTML = rows
      ? `
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Winner</th>
                <th>Draw date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `
      : `<div class="empty-state"><i class="bi bi-clock-history"></i>No results saved for this committee.</div>`;
  } catch (e) {
    toast(e.message);
  }
}

function downloadPdf(id) {
  window.open(`/api/reports/${id}/pdf`, "_blank");
}

document.addEventListener("click", e => {
  const page = e.target.closest("[data-page]");

  if (page) {
    navigate(page.dataset.page);
  }

  const open = e.target.closest("[data-open]");

  if (open) {
    openCommittee(open.dataset.open);
  }

  const action = e.target.closest("[data-action]");

  if (action?.dataset.action === "new-committee") {
    showCreate();
  }

  const goDraw = e.target.closest("[data-go-draw]");

  if (goDraw) {
    navigate("draw");
    $("#drawCommitteeSelect").value = goDraw.dataset.goDraw;
    selectDrawCommittee(goDraw.dataset.goDraw);
  }

  const pdf = e.target.closest("[data-pdf]");

  if (pdf) {
    downloadPdf(pdf.dataset.pdf);
  }

  const deleteButton = e.target.closest("[data-delete-committee]");

  if (deleteButton) {
    deleteCommittee(deleteButton.dataset.deleteCommittee);
  }
});

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  const f = new FormData(e.currentTarget);

  $("#loginError").classList.add("d-none");

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: f.get("username"),
        password: f.get("password")
      })
    });

    showApp(data.admin.username);

    await loadCommittees();
  } catch (err) {
    $("#loginError").textContent = err.message;
    $("#loginError").classList.remove("d-none");
  }
});

$("#logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } finally {
    showLogin();
  }
});

$("#committeeForm").addEventListener("submit", createCommittee);

$("#drawCommitteeSelect").addEventListener("change", e => {
  selectDrawCommittee(e.target.value);
});

$("#fullDrawBtn").addEventListener("click", runFullDraw);
$("#monthlyDrawBtn").addEventListener("click", runMonthlyDraw);

$("#historyCommittee").addEventListener("change", e => {
  loadHistory(e.target.value);
});

$("#pdfBtn").addEventListener("click", () => {
  const id = $("#historyCommittee").value;

  if (id) downloadPdf(id);
});

$("#menuBtn").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#page-create").addEventListener("input", e => {
  if (e.target.name === "totalMonths") {
    buildMonthInputs(e.target.value);
  }
});

// Har fresh page opening par purana login session clear karke login screen dikhao.
(async function init() {
  showLogin();

  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } catch (e) {
    console.error("Session cleanup:", e);
  }

  showLogin();
})();
