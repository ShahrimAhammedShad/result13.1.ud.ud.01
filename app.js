const firebaseConfig = {
  apiKey: "AIzaSyBxxDm2MoiqMcKVknuffitT4wBPku0HKn0",
  authDomain: "result-13-ba007.firebaseapp.com",
  projectId: "result-13-ba007",
  storageBucket: "result-13-ba007.firebasestorage.app",
  messagingSenderId: "935685272084",
  appId: "1:935685272084:web:1dff03ce78c7f4b393ad01"
};

const ADMIN_EMAIL = "admin@coaching.local";
const ADMIN_PASSWORD = "752002";
const ADMIN_TRIGGER_ROLL = "112231";
const rollPattern = /^[0-9]{6}$/;
const localKey = "ideal-coaching-centre-v2";

const elements = {
  studentView: document.querySelector("#studentView"),
  adminView: document.querySelector("#adminView"),
  searchForm: document.querySelector("#searchForm"),
  studentRoll: document.querySelector("#studentRoll"),
  resultArea: document.querySelector("#resultArea"),
  latestResultCard: document.querySelector("#latestResultCard"),
  overallCard: document.querySelector("#overallCard"),
  studentHistoryBody: document.querySelector("#studentHistoryBody"),
  loginPanel: document.querySelector("#loginPanel"),
  loginForm: document.querySelector("#loginForm"),
  adminEmail: document.querySelector("#adminEmail"),
  adminPassword: document.querySelector("#adminPassword"),
  backToSearchBtn: document.querySelector("#backToSearchBtn"),
  dashboard: document.querySelector("#dashboard"),
  logoutBtn: document.querySelector("#logoutBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  studentForm: document.querySelector("#studentForm"),
  studentAdminRoll: document.querySelector("#studentAdminRoll"),
  studentAdminName: document.querySelector("#studentAdminName"),
  studentAdminBatch: document.querySelector("#studentAdminBatch"),
  examForm: document.querySelector("#examForm"),
  examName: document.querySelector("#examName"),
  examDate: document.querySelector("#examDate"),
  fullMarks: document.querySelector("#fullMarks"),
  examPublished: document.querySelector("#examPublished"),
  studentsBody: document.querySelector("#studentsBody"),
  examsBody: document.querySelector("#examsBody"),
  actionTabs: document.querySelectorAll(".action-tab"),
  adminPanels: document.querySelectorAll("[data-admin-panel]"),
  resultForm: document.querySelector("#resultForm"),
  resultExam: document.querySelector("#resultExam"),
  resultRoll: document.querySelector("#resultRoll"),
  resultStudentName: document.querySelector("#resultStudentName"),
  obtainedMarks: document.querySelector("#obtainedMarks"),
  resultStatus: document.querySelector("#resultStatus"),
  computedPreview: document.querySelector("#computedPreview"),
  adminOverview: document.querySelector("#adminOverview"),
  adminFilter: document.querySelector("#adminFilter"),
  examFilter: document.querySelector("#examFilter"),
  resultsBody: document.querySelector("#resultsBody"),
  modeBadge: document.querySelector("#modeBadge"),
  toast: document.querySelector("#toast")
};

let firebaseReady = false;
let auth = null;
let db = null;
let firebaseApi = {};
let students = [];
let exams = [];
let results = [];
let rankedResults = [];
let editingStudentRoll = null;
let editingExamId = null;

boot();

async function boot() {
  await setupFirebase();
  seedDemoData();
  bindEvents();
  await loadData();
  setToday();
}

async function setupFirebase() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    elements.modeBadge.textContent = "Local demo mode";
    return;
  }

  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    firebaseApi = { ...appModule, ...authModule, ...firestoreModule };

    const app = firebaseApi.initializeApp(firebaseConfig);
    auth = firebaseApi.getAuth(app);
    db = firebaseApi.getFirestore(app);
    firebaseReady = true;
    elements.modeBadge.textContent = "Firebase live mode";
    firebaseApi.onAuthStateChanged(auth, (user) => {
      setAdminState(Boolean(user && user.email === ADMIN_EMAIL));
    });
  } catch (error) {
    firebaseReady = false;
    elements.modeBadge.textContent = "Local demo mode";
    showToast(`Firebase is not connected: ${error.message}`);
  }
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const roll = elements.studentRoll.value.trim();
    if (!isValidRoll(roll)) {
      showToast("Roll number must be exactly 6 digits.");
      return;
    }
    if (roll === ADMIN_TRIGGER_ROLL) {
      openAdminPanel();
      return;
    }
    await loadData();
    renderStudentPortal(roll);
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = elements.adminEmail.value.trim();
    const password = elements.adminPassword.value;

    if (firebaseReady) {
      try {
        await firebaseApi.signInWithEmailAndPassword(auth, email, password);
        showToast("Admin login successful.");
      } catch (error) {
        showToast(`Login failed: ${error.message}`);
      }
      return;
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setAdminState(true);
      showToast("Local admin login successful.");
    } else {
      showToast("Wrong admin email or password.");
    }
  });

  elements.backToSearchBtn.addEventListener("click", showStudentPortal);

  elements.actionTabs.forEach((button) => {
    button.addEventListener("click", () => showAdminPanel(button.dataset.panel));
  });

  elements.logoutBtn.addEventListener("click", async () => {
    if (firebaseReady) {
      await firebaseApi.signOut(auth);
    }
    setAdminState(false);
    showStudentPortal();
    showToast("Logged out.");
  });

  elements.studentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const student = readStudentForm();
    if (!student) return;
    await saveStudent(student);
    if (editingStudentRoll && editingStudentRoll !== student.roll) {
      await deleteStudent(editingStudentRoll, false);
    }
    editingStudentRoll = null;
    elements.studentForm.reset();
    elements.studentAdminRoll.disabled = false;
    await loadData();
    showToast("Student saved.");
  });

  elements.examForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const exam = readExamForm();
    if (!exam) return;
    await saveExam(exam);
    editingExamId = null;
    elements.examForm.reset();
    setToday();
    await loadData();
    showToast("Exam saved.");
  });

  elements.resultForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = readResultForm();
    if (!result) return;
    await saveResult(result);
    elements.resultForm.reset();
    elements.resultStudentName.value = "";
    elements.resultStatus.value = "regular";
    elements.obtainedMarks.disabled = false;
    updateResultPreview();
    await loadData();
    showToast("Result saved.");
  });

  elements.resultRoll.addEventListener("input", () => {
    const student = findStudent(elements.resultRoll.value.trim());
    elements.resultStudentName.value = student ? student.name : "";
    updateResultPreview();
  });

  elements.resultExam.addEventListener("change", updateResultPreview);
  elements.obtainedMarks.addEventListener("input", updateResultPreview);
  elements.resultStatus.addEventListener("change", () => {
    elements.obtainedMarks.disabled = elements.resultStatus.value === "expelled";
    updateResultPreview();
  });
  elements.adminFilter.addEventListener("input", renderAdminRows);
  elements.examFilter.addEventListener("change", renderAdminRows);
  elements.exportBtn.addEventListener("click", exportCsv);
}

function showAdminPanel(panelName) {
  elements.actionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelName);
  });
  elements.adminPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== panelName);
  });
}

function openAdminPanel() {
  elements.studentView.classList.add("hidden");
  elements.adminView.classList.remove("hidden");
  elements.resultArea.classList.add("hidden");
  elements.adminEmail.value = "";
  elements.adminPassword.value = "";
  elements.adminEmail.focus();
}

function showStudentPortal() {
  elements.adminView.classList.add("hidden");
  elements.studentView.classList.remove("hidden");
  elements.studentRoll.value = "";
  elements.studentRoll.focus();
}

function setAdminState(isAdmin) {
  elements.loginPanel.classList.toggle("hidden", isAdmin);
  elements.dashboard.classList.toggle("hidden", !isAdmin);
  if (isAdmin) loadData();
}

function setToday() {
  if (!elements.examDate.value) {
    elements.examDate.value = new Date().toISOString().slice(0, 10);
  }
}

function isValidRoll(roll) {
  return rollPattern.test(roll);
}

function readStudentForm() {
  const roll = elements.studentAdminRoll.value.trim();
  const name = elements.studentAdminName.value.trim();
  const batch = elements.studentAdminBatch.value.trim();
  if (!isValidRoll(roll)) {
    showToast("Student roll must be exactly 6 digits.");
    return null;
  }
  if (roll === ADMIN_TRIGGER_ROLL) {
    showToast("This roll is reserved for admin access.");
    return null;
  }
  return { roll, name, batch, updatedAt: new Date().toISOString() };
}

function readExamForm() {
  const name = elements.examName.value.trim();
  const date = elements.examDate.value;
  const fullMarks = Number(elements.fullMarks.value);
  if (!name || !date || !Number.isFinite(fullMarks) || fullMarks <= 0) {
    showToast("Please enter a valid exam name, date, and full marks.");
    return null;
  }
  return {
    id: editingExamId || createExamId(name, date),
    name,
    date,
    fullMarks,
    published: elements.examPublished.checked,
    updatedAt: new Date().toISOString()
  };
}

function readResultForm() {
  const examId = elements.resultExam.value;
  const roll = elements.resultRoll.value.trim();
  const exam = findExam(examId);
  const student = findStudent(roll);
  const status = elements.resultStatus.value;
  const obtained = status === "expelled" ? 0 : Number(elements.obtainedMarks.value);

  if (!exam) {
    showToast("Please select an exam.");
    return null;
  }
  if (!student) {
    showToast("No student found for this roll. Add the student first.");
    return null;
  }
  if (status !== "expelled" && (!Number.isFinite(obtained) || obtained < 0 || obtained > exam.fullMarks)) {
    showToast(`Marks must be between 0 and ${exam.fullMarks}.`);
    return null;
  }

  return {
    id: `${examId}_${roll}`,
    examId,
    roll,
    obtained,
    status,
    updatedAt: new Date().toISOString()
  };
}

async function loadData() {
  if (firebaseReady) {
    try {
      const [studentSnap, examSnap, resultSnap] = await Promise.all([
        firebaseApi.getDocs(firebaseApi.collection(db, "students")),
        firebaseApi.getDocs(firebaseApi.collection(db, "exams")),
        firebaseApi.getDocs(firebaseApi.collection(db, "results"))
      ]);
      students = studentSnap.docs.map((item) => item.data());
      exams = examSnap.docs.map((item) => item.data());
      results = resultSnap.docs.map((item) => item.data());
    } catch (error) {
      showToast(`Could not load Firebase data: ${error.message}`);
    }
  } else {
    const local = getLocalData();
    students = local.students;
    exams = local.exams;
    results = local.results;
  }

  students = students.sort((a, b) => a.roll.localeCompare(b.roll));
  exams = exams.sort((a, b) => new Date(b.date) - new Date(a.date));
  rankedResults = buildRankedResults();
  renderExamOptions();
  renderStudentRows();
  renderExamRows();
  renderAdminOverview();
  renderAdminRows();
}

async function saveStudent(student) {
  if (firebaseReady) {
    await firebaseApi.setDoc(firebaseApi.doc(db, "students", student.roll), student);
    return;
  }
  const local = getLocalData();
  local.students = local.students.filter((item) => item.roll !== student.roll);
  local.students.push(student);
  setLocalData(local);
}

async function deleteStudent(roll, deleteRelatedResults = true) {
  if (firebaseReady) {
    await firebaseApi.deleteDoc(firebaseApi.doc(db, "students", roll));
    if (deleteRelatedResults) {
      const related = results.filter((item) => item.roll === roll);
      await Promise.all(related.map((item) => firebaseApi.deleteDoc(firebaseApi.doc(db, "results", item.id))));
    }
    return;
  }
  const local = getLocalData();
  local.students = local.students.filter((item) => item.roll !== roll);
  if (deleteRelatedResults) {
    local.results = local.results.filter((item) => item.roll !== roll);
  }
  setLocalData(local);
}

async function saveExam(exam) {
  if (firebaseReady) {
    await firebaseApi.setDoc(firebaseApi.doc(db, "exams", exam.id), exam);
    return;
  }
  const local = getLocalData();
  local.exams = local.exams.filter((item) => item.id !== exam.id);
  local.exams.push(exam);
  setLocalData(local);
}

async function deleteExam(id) {
  if (firebaseReady) {
    await firebaseApi.deleteDoc(firebaseApi.doc(db, "exams", id));
    const related = results.filter((item) => item.examId === id);
    await Promise.all(related.map((item) => firebaseApi.deleteDoc(firebaseApi.doc(db, "results", item.id))));
    return;
  }
  const local = getLocalData();
  local.exams = local.exams.filter((item) => item.id !== id);
  local.results = local.results.filter((item) => item.examId !== id);
  setLocalData(local);
}

async function saveResult(result) {
  if (firebaseReady) {
    await firebaseApi.setDoc(firebaseApi.doc(db, "results", result.id), result);
    return;
  }
  const local = getLocalData();
  local.results = local.results.filter((item) => item.id !== result.id);
  local.results.push(result);
  setLocalData(local);
}

async function deleteResult(id) {
  if (firebaseReady) {
    await firebaseApi.deleteDoc(firebaseApi.doc(db, "results", id));
    return;
  }
  const local = getLocalData();
  local.results = local.results.filter((item) => item.id !== id);
  setLocalData(local);
}

function buildRankedResults() {
  const enriched = results
    .map((result) => {
      const student = findStudent(result.roll);
      const exam = findExam(result.examId);
      if (!student || !exam) return null;
      const status = result.status || "regular";
      const isExpelled = status === "expelled";
      const percentage = isExpelled ? 0 : (Number(result.obtained) / Number(exam.fullMarks)) * 100;
      return {
        ...result,
        status,
        isExpelled,
        studentName: student.name,
        batch: student.batch,
        examName: exam.name,
        examDate: exam.date,
        fullMarks: Number(exam.fullMarks),
        published: Boolean(exam.published),
        percentage,
        gpa: isExpelled ? null : percentageToGpa(percentage),
        grade: isExpelled ? "Expelled" : percentageToGrade(percentage)
      };
    })
    .filter(Boolean);

  exams.forEach((exam) => {
    const examResults = enriched
      .filter((item) => item.examId === exam.id && !item.isExpelled)
      .sort((a, b) => b.percentage - a.percentage || a.roll.localeCompare(b.roll));
    assignMerit(examResults, "examMerit", "percentage");
  });

  const overallRows = buildOverallRows(enriched.filter((item) => item.published && !item.isExpelled));
  overallRows.forEach((row) => {
    enriched
      .filter((item) => item.roll === row.roll)
      .forEach((item) => {
        item.overallAverage = row.average;
        item.overallMerit = row.overallMerit;
        item.examCount = row.examCount;
      });
  });

  return enriched.sort((a, b) => new Date(b.examDate) - new Date(a.examDate));
}

function buildOverallRows(sourceResults) {
  const grouped = new Map();
  sourceResults.forEach((item) => {
    if (!grouped.has(item.roll)) {
      grouped.set(item.roll, { roll: item.roll, totalPercentage: 0, examCount: 0 });
    }
    const row = grouped.get(item.roll);
    row.totalPercentage += item.percentage;
    row.examCount += 1;
  });

  const rows = Array.from(grouped.values()).map((item) => ({
    ...item,
    average: item.examCount ? item.totalPercentage / item.examCount : 0
  }));
  rows.sort((a, b) => b.average - a.average || a.roll.localeCompare(b.roll));
  assignMerit(rows, "overallMerit", "average");
  return rows;
}

function assignMerit(rows, fieldName, scoreField) {
  let lastScore = null;
  let lastRank = 0;
  rows.forEach((item, index) => {
    const score = Number(item[scoreField].toFixed(4));
    const rank = score === lastScore ? lastRank : index + 1;
    item[fieldName] = rank;
    lastScore = score;
    lastRank = rank;
  });
}

function renderStudentPortal(roll) {
  const student = findStudent(roll);
  const publishedResults = rankedResults
    .filter((item) => item.roll === roll && item.published)
    .sort((a, b) => new Date(b.examDate) - new Date(a.examDate));

  elements.resultArea.classList.remove("hidden");

  if (!student) {
    elements.latestResultCard.innerHTML = `
      <h3>No student found</h3>
      <p>No registered student is available for roll ${escapeHtml(roll)}.</p>
    `;
    elements.overallCard.innerHTML = "";
    elements.studentHistoryBody.innerHTML = `<tr><td data-label="Status" colspan="5">No result found.</td></tr>`;
    return;
  }

  if (!publishedResults.length) {
    elements.latestResultCard.innerHTML = `
      <h3>${escapeHtml(student.name)}</h3>
      <p>Roll: ${escapeHtml(student.roll)} | Batch: ${escapeHtml(student.batch)}</p>
      <p>No published result is available yet.</p>
    `;
    elements.overallCard.innerHTML = "";
    elements.studentHistoryBody.innerHTML = `<tr><td data-label="Status" colspan="5">No published result found.</td></tr>`;
    return;
  }

  const latest = publishedResults[0];
  const overall = buildOverallRows(rankedResults.filter((item) => item.published && !item.isExpelled)).find((item) => item.roll === roll);
  const overallSummary = overall
    ? `
      <p class="eyebrow">Overall performance</p>
      <h3>Combined Merit Position: ${ordinal(overall.overallMerit)}</h3>
      <div class="metric-grid">
        ${metric("Exam Count", overall.examCount)}
        ${metric("Average", `${overall.average.toFixed(2)}%`)}
        ${metric("Overall GPA", percentageToGpa(overall.average).toFixed(2))}
        ${metric("Status", overall.average >= 33 ? "Passed" : "Needs Improvement")}
      </div>
    `
    : `
      <p class="eyebrow">Overall performance</p>
      <h3>No ranked result available</h3>
      <p>Published results are available, but this student has no regular ranked result yet.</p>
    `;
  const latestScore = latest.isExpelled
    ? `<div class="score-display expelled"><span>Status</span><b>Expelled</b></div>`
    : `<div class="score-display"><span>Marks</span><b>${latest.obtained}/${latest.fullMarks}</b></div>`;
  const latestMetrics = latest.isExpelled
    ? `
      ${metric("Status", "Expelled")}
      ${metric("Merit Position", "-")}
      ${metric("GPA", "-")}
      ${metric("Grade", "Expelled")}
    `
    : `
      ${metric("Merit Position", ordinal(latest.examMerit))}
      ${metric("GPA", latest.gpa.toFixed(2))}
      ${metric("Grade", latest.grade)}
      ${metric("Percentage", `${latest.percentage.toFixed(2)}%`)}
    `;

  elements.latestResultCard.innerHTML = `
    <div class="result-top">
      <div>
        <p class="eyebrow">Latest result</p>
        <h2>${escapeHtml(latest.examName)}</h2>
        <p>${formatDate(latest.examDate)} | ${escapeHtml(student.name)} | Roll ${escapeHtml(student.roll)}</p>
      </div>
      ${latestScore}
    </div>
    <div class="metric-grid">
      ${latestMetrics}
    </div>
  `;

  elements.overallCard.innerHTML = overallSummary;

  elements.studentHistoryBody.innerHTML = publishedResults.map((item) => `
    <tr>
      <td data-label="Exam">${escapeHtml(item.examName)}</td>
      <td data-label="Date">${formatDate(item.examDate)}</td>
      <td data-label="Marks">${item.isExpelled ? "Expelled" : `${item.obtained}/${item.fullMarks} (${item.percentage.toFixed(2)}%)`}</td>
      <td data-label="GPA">${item.isExpelled ? "Expelled" : `${item.gpa.toFixed(2)} (${item.grade})`}</td>
      <td data-label="Merit">${item.isExpelled ? "-" : ordinal(item.examMerit)}</td>
    </tr>
  `).join("");
}

function renderExamOptions() {
  const options = exams.map((exam) => (
    `<option value="${escapeHtml(exam.id)}">${escapeHtml(exam.name)} - ${formatDate(exam.date)}</option>`
  )).join("");

  elements.resultExam.innerHTML = options || `<option value="">No exam created</option>`;
  elements.examFilter.innerHTML = `<option value="">All exams</option>${options}`;
}

function renderStudentRows() {
  if (!elements.studentsBody) return;
  if (!students.length) {
    elements.studentsBody.innerHTML = `<tr><td data-label="Status" colspan="4">No student found.</td></tr>`;
    return;
  }

  elements.studentsBody.innerHTML = students.map((student) => `
    <tr>
      <td data-label="Roll">${escapeHtml(student.roll)}</td>
      <td data-label="Name">${escapeHtml(student.name)}</td>
      <td data-label="Batch">${escapeHtml(student.batch)}</td>
      <td data-label="Action">
        <div class="action-row">
          <button class="mini-btn" type="button" data-student-edit="${escapeHtml(student.roll)}">Edit</button>
          <button class="mini-btn danger" type="button" data-student-delete="${escapeHtml(student.roll)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  elements.studentsBody.querySelectorAll("[data-student-edit]").forEach((button) => {
    button.addEventListener("click", () => fillStudentForm(button.dataset.studentEdit));
  });
  elements.studentsBody.querySelectorAll("[data-student-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteStudent(button.dataset.studentDelete);
      await loadData();
      showToast("Student deleted.");
    });
  });
}

function renderExamRows() {
  if (!elements.examsBody) return;
  if (!exams.length) {
    elements.examsBody.innerHTML = `<tr><td data-label="Status" colspan="5">No exam found.</td></tr>`;
    return;
  }

  elements.examsBody.innerHTML = exams.map((exam) => `
    <tr>
      <td data-label="Exam">${escapeHtml(exam.name)}</td>
      <td data-label="Date">${formatDate(exam.date)}</td>
      <td data-label="Full Marks">${exam.fullMarks}</td>
      <td data-label="Status">${exam.published ? "Published" : "Unpublished"}</td>
      <td data-label="Action">
        <div class="action-row">
          <button class="mini-btn" type="button" data-exam-edit="${escapeHtml(exam.id)}">Edit</button>
          <button class="mini-btn" type="button" data-exam-toggle="${escapeHtml(exam.id)}">${exam.published ? "Unpublish" : "Publish"}</button>
          <button class="mini-btn danger" type="button" data-exam-delete="${escapeHtml(exam.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  elements.examsBody.querySelectorAll("[data-exam-edit]").forEach((button) => {
    button.addEventListener("click", () => fillExamForm(button.dataset.examEdit));
  });
  elements.examsBody.querySelectorAll("[data-exam-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const exam = findExam(button.dataset.examToggle);
      if (!exam) return;
      await saveExam({ ...exam, published: !exam.published, updatedAt: new Date().toISOString() });
      await loadData();
      showToast(exam.published ? "Exam unpublished." : "Exam published.");
    });
  });
  elements.examsBody.querySelectorAll("[data-exam-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteExam(button.dataset.examDelete);
      await loadData();
      showToast("Exam deleted.");
    });
  });
}

function fillStudentForm(roll) {
  const student = findStudent(roll);
  if (!student) return;
  showAdminPanel("studentPanel");
  editingStudentRoll = roll;
  elements.studentAdminRoll.value = student.roll;
  elements.studentAdminRoll.disabled = true;
  elements.studentAdminName.value = student.name;
  elements.studentAdminBatch.value = student.batch;
  showToast("Student loaded for editing.");
}

function fillExamForm(id) {
  const exam = findExam(id);
  if (!exam) return;
  showAdminPanel("examPanel");
  editingExamId = id;
  elements.examName.value = exam.name;
  elements.examDate.value = exam.date;
  elements.fullMarks.value = exam.fullMarks;
  elements.examPublished.checked = Boolean(exam.published);
  showToast("Exam loaded for editing.");
}

function renderAdminOverview() {
  const publishedExams = exams.filter((exam) => exam.published).length;
  const regularResults = rankedResults.filter((item) => !item.isExpelled);
  const expelledCount = rankedResults.filter((item) => item.isExpelled).length;
  const avg = regularResults.length
    ? regularResults.reduce((sum, item) => sum + item.percentage, 0) / regularResults.length
    : 0;
  const top = regularResults
    .filter((item) => item.published)
    .sort((a, b) => b.percentage - a.percentage)[0];

  elements.adminOverview.innerHTML = `
    ${stat("Students", students.length)}
    ${stat("Exams", `${exams.length} total`)}
    ${stat("Published", publishedExams)}
    ${stat("Average Score", `${avg.toFixed(2)}%`)}
    ${stat("Results", rankedResults.length)}
    ${stat("Expelled", expelledCount)}
    ${stat("Top Score", top ? `${top.studentName} (${top.percentage.toFixed(2)}%)` : "No result")}
    ${stat("Latest Exam", exams[0] ? exams[0].name : "No exam")}
    ${stat("Mode", firebaseReady ? "Firebase" : "Local")}
  `;
}

function renderAdminRows() {
  const filter = elements.adminFilter.value.trim().toLowerCase();
  const examFilter = elements.examFilter.value;
  const rows = rankedResults.filter((item) => {
    const searchable = [item.roll, item.studentName, item.batch, item.examName].join(" ").toLowerCase();
    return searchable.includes(filter) && (!examFilter || item.examId === examFilter);
  });

  if (!rows.length) {
    elements.resultsBody.innerHTML = `<tr><td data-label="Status" colspan="8">No result found.</td></tr>`;
    return;
  }

  elements.resultsBody.innerHTML = rows.map((item) => `
    <tr>
      <td data-label="Roll">${escapeHtml(item.roll)}</td>
      <td data-label="Name">${escapeHtml(item.studentName)}</td>
      <td data-label="Batch">${escapeHtml(item.batch)}</td>
      <td data-label="Exam">${escapeHtml(item.examName)}${item.published ? "" : " (Draft)"}</td>
      <td data-label="Marks">${item.isExpelled ? "Expelled" : `${item.obtained}/${item.fullMarks} (${item.percentage.toFixed(2)}%)`}</td>
      <td data-label="GPA">${item.isExpelled ? "Expelled" : `${item.gpa.toFixed(2)} (${item.grade})`}</td>
      <td data-label="Merit">${item.isExpelled ? "-" : ordinal(item.examMerit)}</td>
      <td data-label="Action">
        <div class="action-row">
          <button class="mini-btn" type="button" data-edit="${escapeHtml(item.id)}">Edit</button>
          <button class="mini-btn danger" type="button" data-delete="${escapeHtml(item.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  elements.resultsBody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => fillResultForm(button.dataset.edit));
  });

  elements.resultsBody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteResult(button.dataset.delete);
      await loadData();
      showToast("Result deleted.");
    });
  });
}

function fillResultForm(id) {
  const item = rankedResults.find((result) => result.id === id);
  if (!item) return;
  elements.resultExam.value = item.examId;
  elements.resultRoll.value = item.roll;
  elements.resultStudentName.value = item.studentName;
  elements.obtainedMarks.value = item.obtained;
  elements.resultStatus.value = item.status || "regular";
  elements.obtainedMarks.disabled = item.isExpelled;
  updateResultPreview();
  showToast("Result loaded for editing.");
}

function updateResultPreview() {
  const exam = findExam(elements.resultExam.value);
  const roll = elements.resultRoll.value.trim();
  const student = findStudent(roll);
  const obtained = Number(elements.obtainedMarks.value);
  const status = elements.resultStatus.value;

  if (!exam || !student || !Number.isFinite(obtained)) {
    elements.computedPreview.textContent = "Select an exam and enter marks to preview GPA and merit.";
    return;
  }

  if (status === "expelled") {
    elements.computedPreview.textContent = `${student.name} | Status: Expelled | This result will show as Expelled after the exam is published.`;
    return;
  }

  const percentage = (obtained / exam.fullMarks) * 100;
  const gpa = percentageToGpa(percentage);
  const examRows = rankedResults.filter((item) => item.examId === exam.id && item.roll !== roll);
  examRows.push({ roll, percentage });
  examRows.sort((a, b) => b.percentage - a.percentage || a.roll.localeCompare(b.roll));
  assignMerit(examRows, "examMerit", "percentage");
  const preview = examRows.find((item) => item.roll === roll);

  elements.computedPreview.textContent = `${student.name} | ${percentage.toFixed(2)}% | GPA ${gpa.toFixed(2)} | Estimated merit ${ordinal(preview.examMerit)}`;
}

function exportCsv() {
  const header = ["Roll", "Name", "Batch", "Exam", "Date", "Status", "Obtained", "Full Marks", "Percentage", "GPA", "Grade", "Merit"];
  const rows = rankedResults.map((item) => [
    item.roll,
    item.studentName,
    item.batch,
    item.examName,
    item.examDate,
    item.isExpelled ? "Expelled" : "Regular",
    item.obtained,
    item.fullMarks,
    item.isExpelled ? "" : item.percentage.toFixed(2),
    item.isExpelled ? "" : item.gpa.toFixed(2),
    item.grade,
    item.isExpelled ? "" : item.examMerit
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ideal-coaching-centre-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function findStudent(roll) {
  return students.find((student) => student.roll === roll);
}

function findExam(id) {
  return exams.find((exam) => exam.id === id);
}

function createExamId(name, date) {
  return `${date}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "exam"}`;
}

function percentageToGpa(percentage) {
  if (percentage < 33) return 0;
  return Math.min(5, percentage / 20);
}

function percentageToGrade(percentage) {
  if (percentage >= 80) return "A+";
  if (percentage >= 70) return "A";
  if (percentage >= 60) return "A-";
  if (percentage >= 50) return "B";
  if (percentage >= 40) return "C";
  if (percentage >= 33) return "D";
  return "F";
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function stat(label, value) {
  return `<div class="stat-card"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const suffixes = ["th", "st", "nd", "rd"];
  const mod100 = number % 100;
  return `${number}${suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function getLocalData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(localKey) || "{}");
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : [],
      results: Array.isArray(parsed.results) ? parsed.results : []
    };
  } catch {
    return { students: [], exams: [], results: [] };
  }
}

function setLocalData(data) {
  localStorage.setItem(localKey, JSON.stringify(data));
}

function seedDemoData() {
  if (firebaseReady || localStorage.getItem(localKey)) return;
  setLocalData({
    students: [
      { roll: "123456", name: "Rahim Uddin", batch: "Class 9 - Batch A" },
      { roll: "234567", name: "Nusrat Jahan", batch: "Class 9 - Batch A" },
      { roll: "345678", name: "Tanvir Hasan", batch: "Class 10 - Batch B" },
      { roll: "456789", name: "Sadia Akter", batch: "Class 10 - Batch B" }
    ],
    exams: [
      { id: "2026-06-01-monthly-test-01", name: "Monthly Test 01", date: "2026-06-01", fullMarks: 100, published: true },
      { id: "2026-06-10-model-test-01", name: "Model Test 01", date: "2026-06-10", fullMarks: 100, published: true }
    ],
    results: [
      { id: "2026-06-01-monthly-test-01_123456", examId: "2026-06-01-monthly-test-01", roll: "123456", obtained: 86 },
      { id: "2026-06-01-monthly-test-01_234567", examId: "2026-06-01-monthly-test-01", roll: "234567", obtained: 78 },
      { id: "2026-06-01-monthly-test-01_345678", examId: "2026-06-01-monthly-test-01", roll: "345678", obtained: 91 },
      { id: "2026-06-01-monthly-test-01_456789", examId: "2026-06-01-monthly-test-01", roll: "456789", obtained: 68 },
      { id: "2026-06-10-model-test-01_123456", examId: "2026-06-10-model-test-01", roll: "123456", obtained: 89 },
      { id: "2026-06-10-model-test-01_234567", examId: "2026-06-10-model-test-01", roll: "234567", obtained: 84 },
      { id: "2026-06-10-model-test-01_345678", examId: "2026-06-10-model-test-01", roll: "345678", obtained: 88 },
      { id: "2026-06-10-model-test-01_456789", examId: "2026-06-10-model-test-01", roll: "456789", obtained: 74 }
    ]
  });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3000);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
