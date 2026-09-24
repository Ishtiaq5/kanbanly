(function () {
  "use strict";

  var STORAGE_KEY = "kanbanly.board.v1";

  var COLUMNS = [
    { id: "backlog", title: "Backlog", accent: "violet" },
    { id: "progress", title: "In Progress", accent: "cyan" },
    { id: "done", title: "Done", accent: "lime" }
  ];

  function uid() {
    return "t" + Math.random().toString(36).slice(2, 9);
  }

  var DEFAULT_TASKS = [
    { id: uid(), title: "Sketch the onboarding flow", tag: "Design", priority: "high", col: "backlog" },
    { id: uid(), title: "Write the launch announcement", tag: "Marketing", priority: "med", col: "backlog" },
    { id: uid(), title: "Ship the new pricing page", tag: "Dev", priority: "high", col: "progress" },
    { id: uid(), title: "Audit spacing on small screens", tag: "QA", priority: "low", col: "progress" },
    { id: uid(), title: "Set up the project repository", tag: "Dev", priority: "med", col: "done" }
  ];

  var state = load();
  var els = {
    board: document.getElementById("board"),
    total: document.getElementById("stat-total"),
    done: document.getElementById("stat-done"),
    percent: document.getElementById("stat-percent"),
    progressBar: document.getElementById("progress-bar"),
    progressFill: document.getElementById("progress-fill")
  };

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Object.prototype.toString.call(parsed.tasks) === "[object Array]") {
          return parsed;
        }
      }
    } catch (err) { /* storage unavailable */ }
    return { tasks: DEFAULT_TASKS.slice() };
  }

  function save() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
  }

  function tasksIn(colId) {
    return state.tasks.filter(function (t) { return t.col === colId; });
  }

  function buildCard(task) {
    var li = document.createElement("li");
    li.className = "card";
    li.draggable = true;
    li.setAttribute("data-id", task.id);
    li.setAttribute("data-priority", task.priority);
    li.setAttribute("tabindex", "0");
    li.setAttribute("aria-label", task.title + ", tag " + task.tag + ", priority " + task.priority);

    var title = document.createElement("p");
    title.className = "card-title";
    title.textContent = task.title;

    var meta = document.createElement("div");
    meta.className = "card-meta";

    var tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = task.tag;

    var actions = document.createElement("div");
    actions.className = "card-actions";

    var leftBtn = iconButton("\u2190", "Move left", function () { moveTask(task.id, -1); });
    var rightBtn = iconButton("\u2192", "Move right", function () { moveTask(task.id, 1); });
    var delBtn = iconButton("\u00d7", "Delete task", function () { removeTask(task.id); });
    delBtn.classList.add("danger");

    actions.appendChild(leftBtn);
    actions.appendChild(rightBtn);
    actions.appendChild(delBtn);
    meta.appendChild(tag);
    meta.appendChild(actions);
    li.appendChild(title);
    li.appendChild(meta);
    bindDrag(li, task.id);
    return li;
  }

  function iconButton(glyph, label, handler) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn";
    b.textContent = glyph;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.addEventListener("click", handler);
    return b;
  }

  function buildColumn(col) {
    var section = document.createElement("section");
    section.className = "column";
    section.setAttribute("data-col", col.id);
    section.setAttribute("aria-labelledby", "col-" + col.id);

    var head = document.createElement("div");
    head.className = "column-head";
    var dot = document.createElement("span");
    dot.className = "dot " + col.accent;
    dot.setAttribute("aria-hidden", "true");
    var h = document.createElement("h2");
    h.className = "column-title";
    h.id = "col-" + col.id;
    h.textContent = col.title;
    var count = document.createElement("span");
    count.className = "count";
    count.setAttribute("data-count", col.id);
    head.appendChild(dot);
    head.appendChild(h);
    head.appendChild(count);

    var list = document.createElement("ul");
    list.className = "card-list";
    list.setAttribute("data-list", col.id);

    var form = document.createElement("form");
    form.className = "add-form";
    form.setAttribute("aria-label", "Add task to " + col.title);
    var input = document.createElement("input");
    input.className = "add-input";
    input.type = "text";
    input.placeholder = "Add a task\u2026";
    input.setAttribute("aria-label", "New task title for " + col.title);
    input.maxLength = 90;
    var btn = document.createElement("button");
    btn.className = "add-btn";
    btn.type = "submit";
    btn.textContent = "+";
    btn.setAttribute("aria-label", "Add task");
    form.appendChild(input);
    form.appendChild(btn);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input.value.trim();
      if (!value) { return; }
      state.tasks.unshift({
        id: uid(), title: value, tag: "New",
        priority: col.id === "done" ? "low" : "med", col: col.id
      });
      input.value = "";
      save();
      render();
      input.focus();
    });

    section.appendChild(head);
    section.appendChild(list);
    section.appendChild(form);
    bindDropZone(section, col.id);
    return section;
  }

  function render() {
    els.board.innerHTML = "";
    COLUMNS.forEach(function (col) {
      var section = buildColumn(col);
      var list = section.querySelector('[data-list="' + col.id + '"]');
      tasksIn(col.id).forEach(function (task) { list.appendChild(buildCard(task)); });
      section.querySelector('[data-count="' + col.id + '"]').textContent = tasksIn(col.id).length;
      els.board.appendChild(section);
    });
    updateStats();
  }

  function updateStats() {
    var total = state.tasks.length;
    var done = tasksIn("done").length;
    var percent = total ? Math.round((done / total) * 100) : 0;
    els.total.textContent = total;
    els.done.textContent = done;
    els.percent.textContent = percent + "%";
    els.progressFill.style.width = percent + "%";
    els.progressBar.setAttribute("aria-valuenow", String(percent));
  }

  function byId(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === id) { return state.tasks[i]; }
    }
    return null;
  }

  function moveTask(id, direction) {
    var task = byId(id);
    if (!task) { return; }
    var idx = COLUMNS.map(function (c) { return c.id; }).indexOf(task.col);
    var next = Math.min(COLUMNS.length - 1, Math.max(0, idx + direction));
    if (next === idx) { return; }
    task.col = COLUMNS[next].id;
    save();
    render();
  }

  function setColumn(id, colId) {
    var task = byId(id);
    if (!task || task.col === colId) { return; }
    task.col = colId;
    save();
    render();
  }

  function removeTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    save();
    render();
  }

  function bindDrag(card, id) {
    card.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Delete" || e.key === "Backspace") { removeTask(id); }
      if (e.key === "ArrowRight") { e.preventDefault(); moveTask(id, 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); moveTask(id, -1); }
    });
  }

  function bindDropZone(section, colId) {
    section.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      section.classList.add("drop-active");
    });
    section.addEventListener("dragleave", function (e) {
      if (!section.contains(e.relatedTarget)) { section.classList.remove("drop-active"); }
    });
    section.addEventListener("drop", function (e) {
      e.preventDefault();
      section.classList.remove("drop-active");
      var id = e.dataTransfer.getData("text/plain");
      if (id) { setColumn(id, colId); }
    });
  }

  render();
})();
