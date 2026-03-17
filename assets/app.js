async function loadNewsData() {
  const isArchive = document.body.dataset.view === "archive";
  const dataPath = isArchive ? "../data/news.json" : "data/news.json";
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`Failed to load ${dataPath}`);
  }
  return response.json();
}

function resolveRunPath(pagePath) {
  return document.body.dataset.view === "archive" ? `../${pagePath}` : pagePath;
}

function formatDate(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function localIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderArchive(data) {
  const archiveList = document.getElementById("archive-list");
  if (!archiveList) {
    return;
  }

  archiveList.innerHTML = data.runs
    .map(
      (run) => `
        <article class="archive-item">
          <div class="archive-meta">
            <span>${run.slot}</span>
            <span>${formatDate(run.date)}</span>
            <span>${run.articleCount} articles</span>
          </div>
          <h3>${run.title}</h3>
          <p>${run.summary}</p>
          <div class="tag-row">
            ${run.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <a class="text-link" href="${resolveRunPath(run.page)}">Open run page</a>
        </article>
      `,
    )
    .join("");
}

function toFeedItem(article, idx, category, run) {
  return {
    id: `${run.id}-${category}-${idx + 1}`,
    category,
    displayTitle: article.displayTitle || article.title,
    paperTitle: article.title,
    summary: article.summary,
    conclusions: article.conclusions || [],
    image: article.image,
    link: article.link,
    source: article.journal,
    quartile: article.quartile,
    publishedAt: article.publishedAt,
    runLabel: run.slot,
  };
}

function sortRunsDesc(runs) {
  return [...runs].sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    return (b.id || "").localeCompare(a.id || "");
  });
}

function normalizeHomeData(data, selectedRun) {
  const selectedArticles = Array.isArray(selectedRun?.articles) ? selectedRun.articles : [];
  const materials = selectedArticles.map((article, idx) =>
    toFeedItem(article, idx, "materials", selectedRun),
  );
  const techScience = (data.categories?.tech_science || []).map((item, idx) =>
    toFeedItem(item, idx, "tech_science", selectedRun),
  );
  const world = (data.categories?.world || []).map((item, idx) =>
    toFeedItem(item, idx, "world", selectedRun),
  );

  const pools = [
    { key: "materials", items: materials },
    { key: "tech_science", items: techScience },
    { key: "world", items: world },
  ];
  const pointers = { materials: 0, tech_science: 0, world: 0 };
  const forYou = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const pool of pools) {
      const idx = pointers[pool.key];
      if (idx < pool.items.length) {
        forYou.push(pool.items[idx]);
        pointers[pool.key] += 1;
        progress = true;
      }
    }
  }

  return {
    selectedRun,
    tabs: {
      for_you: forYou,
      materials,
      tech_science: techScience,
      world,
    },
  };
}

function createConclusions(conclusions) {
  if (!conclusions.length) {
    return "<p class=\"card-empty\">Top conclusions will appear after the next ingestion cycle.</p>";
  }

  return `
    <ul class="card-conclusions">
      ${conclusions.map((point) => `<li>${point}</li>`).join("")}
    </ul>
  `;
}

function createFeedCard(item) {
  const meta = [item.source, item.quartile, formatDate(item.publishedAt), item.runLabel]
    .filter(Boolean)
    .map((chunk) => `<span>${chunk}</span>`)
    .join("");
  const imageSrc = item.image?.src || "assets/images/sample-framework.svg";
  const imageAlt = item.image?.alt || `Placeholder visual for ${item.displayTitle}`;

  return `
    <article class="news-card">
      <div class="news-image-wrap">
        <img class="news-image" src="${imageSrc}" alt="${imageAlt}" loading="lazy" />
      </div>
      <div class="news-main">
        <div class="news-meta">${meta}</div>
        <h2>${item.displayTitle}</h2>
        <button
          class="expand-btn"
          type="button"
          aria-expanded="false"
          aria-controls="${item.id}-details"
          data-target="${item.id}-details"
        >
          Show summary + conclusions
        </button>
        <section class="news-details" id="${item.id}-details" hidden>
          <h3>Summary</h3>
          <p>${item.summary}</p>
          <h3>Top conclusions</h3>
          ${createConclusions(item.conclusions)}
          <p class="paper-title"><strong>Original paper title:</strong> ${item.paperTitle}</p>
          <a class="paper-link" href="${item.link}" target="_blank" rel="noreferrer">Open original source</a>
        </section>
      </div>
    </article>
  `;
}

function renderFeedItems(items) {
  const cardsStream = document.getElementById("cards-stream");
  const feedCount = document.getElementById("feed-count");
  if (!cardsStream) {
    return;
  }

  if (feedCount) {
    feedCount.textContent = `${items.length} items`;
  }
  if (!items.length) {
    cardsStream.innerHTML = `
      <article class="empty-card">
        <h2>No entries yet in this category</h2>
        <p>The feed schema is ready. The next automation run will populate this category with live news.</p>
      </article>
    `;
    return;
  }

  cardsStream.innerHTML = items.map(createFeedCard).join("");
}

function initTabBehavior() {
  const tabsEl = document.getElementById("feed-tabs");
  if (!tabsEl) {
    return { setTabs: () => {} };
  }

  let activeTab = "for_you";
  let currentTabs = {
    for_you: [],
    materials: [],
    tech_science: [],
    world: [],
  };

  const setTabs = (tabs, keepActiveIfPossible = false) => {
    currentTabs = tabs;
    const orderedTabs = ["for_you", "materials", "tech_science", "world"];
    const firstNonEmptyTab =
      orderedTabs.find((tabKey) => (currentTabs[tabKey] || []).length > 0) || "for_you";

    if (!keepActiveIfPossible || !(currentTabs[activeTab] || []).length) {
      activeTab = (currentTabs.for_you || []).length > 0 ? "for_you" : firstNonEmptyTab;
    }

    tabsEl.querySelectorAll(".feed-tab").forEach((tabBtn) => {
      const key = tabBtn.dataset.tab;
      const hasItems = (currentTabs[key] || []).length > 0;
      tabBtn.classList.toggle("is-disabled", !hasItems);
      tabBtn.disabled = !hasItems;
      tabBtn.setAttribute("aria-disabled", String(!hasItems));
      if (!hasItems) {
        tabBtn.title = "No items yet for this category";
      } else {
        tabBtn.title = "";
      }
      tabBtn.classList.toggle("is-active", key === activeTab);
    });

    renderFeedItems(currentTabs[activeTab] || []);
  };

  tabsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn || btn.disabled) {
      return;
    }

    activeTab = btn.dataset.tab;
    tabsEl.querySelectorAll(".feed-tab").forEach((tabBtn) => {
      tabBtn.classList.toggle("is-active", tabBtn === btn);
    });
    renderFeedItems(currentTabs[activeTab] || []);
  });

  return { setTabs };
}

function initCardExpandBehavior() {
  const cardsStream = document.getElementById("cards-stream");
  if (!cardsStream) {
    return;
  }

  cardsStream.addEventListener("click", (event) => {
    const button = event.target.closest(".expand-btn");
    if (!button) {
      return;
    }

    const targetId = button.dataset.target;
    const details = document.getElementById(targetId);
    if (!details) {
      return;
    }

    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded
      ? "Show summary + conclusions"
      : "Hide summary + conclusions";
    details.hidden = expanded;
  });
}

function initRunDatePicker(runs, onRunSelected) {
  const picker = document.getElementById("run-date-picker");
  const hint = document.getElementById("run-date-hint");
  if (!picker || !runs.length) {
    return runs[0];
  }

  const runsByDate = new Map();
  runs.forEach((run) => {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, run);
    }
  });

  const availableDates = [...runsByDate.keys()].sort((a, b) => b.localeCompare(a));
  const latestDate = availableDates[0];
  const today = localIsoDate();
  const defaultDate = runsByDate.has(today) ? today : latestDate;

  picker.min = availableDates[availableDates.length - 1];
  picker.max = availableDates[0];
  picker.value = defaultDate;

  const selectedRun =
    runsByDate.get(defaultDate) ||
    runs.find((run) => Array.isArray(run.articles) && run.articles.length > 0);
  if (hint) {
    hint.textContent = selectedRun ? selectedRun.slot : "Select date to open that run";
  }

  picker.addEventListener("change", () => {
    const run = runsByDate.get(picker.value);
    if (!run) {
      if (hint) {
        hint.textContent = "No run found for selected date";
      }
      return;
    }
    if (hint) {
      hint.textContent = run.slot || "Run selected";
    }
    if (onRunSelected) {
      onRunSelected(run);
    }
  });

  return selectedRun || runs[0];
}

function renderHome(data) {
  const runs = sortRunsDesc(data.runs || []);
  const tabController = initTabBehavior();
  initCardExpandBehavior();

  const applyRunToFeed = (run, keepActiveTab = false) => {
    const normalized = normalizeHomeData(data, run);
    tabController.setTabs(normalized.tabs, keepActiveTab);
  };

  const selectedRun =
    initRunDatePicker(runs, (run) => applyRunToFeed(run, true)) ||
    runs.find((run) => Array.isArray(run.articles) && run.articles.length > 0) ||
    runs[0];
  if (!selectedRun) {
    renderFeedItems([]);
    return;
  }
  applyRunToFeed(selectedRun, false);
}

loadNewsData()
  .then((data) => {
    if (document.body.dataset.view === "archive") {
      renderArchive(data);
      return;
    }
    renderHome(data);
  })
  .catch((error) => {
    const fallback = document.createElement("p");
    fallback.textContent = error.message;
    document.body.appendChild(fallback);
  });
