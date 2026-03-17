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
  };
}

function sortRunsDesc(runs) {
  const runPriority = (run) => {
    const slot = (run.slot || "").toLowerCase();
    if (slot.includes("evening") || slot.includes("pm") || slot.includes("16:")) {
      return 2;
    }
    if (slot.includes("morning") || slot.includes("am") || slot.includes("06:")) {
      return 1;
    }
    return 0;
  };

  return [...runs].sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    const runOrder = runPriority(b) - runPriority(a);
    if (runOrder !== 0) {
      return runOrder;
    }
    return (b.id || "").localeCompare(a.id || "");
  });
}

function normalizeHomeData(data, selectedRuns) {
  const materials = [];
  selectedRuns.forEach((run) => {
    const selectedArticles = Array.isArray(run?.articles) ? run.articles : [];
    selectedArticles.forEach((article, idx) => {
      materials.push(toFeedItem(article, idx, "materials", run));
    });
  });

  const selectedCategoryData = selectedRuns[0]?.categories || {
    tech_science: [],
    world: [],
  };

  const techScience = (selectedCategoryData.tech_science || []).map((item, idx) =>
    toFeedItem(item, idx, "tech_science", selectedRuns[0]),
  );
  const world = (selectedCategoryData.world || []).map((item, idx) =>
    toFeedItem(item, idx, "world", selectedRuns[0]),
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
    selectedRuns,
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
  const meta = [item.source, item.quartile, formatDate(item.publishedAt)]
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

function initRunDateControls(runs, onRunsSelected) {
  const prevBtn = document.getElementById("date-prev");
  const todayBtn = document.getElementById("date-today");
  const nextBtn = document.getElementById("date-next");
  const label = document.getElementById("date-nav-label");
  if (!prevBtn || !todayBtn || !nextBtn || !label || !runs.length) {
    return runs.length ? [runs[0]] : [];
  }

  const runsByDate = new Map();
  runs.forEach((run) => {
    if (!runsByDate.has(run.date)) {
      runsByDate.set(run.date, []);
    }
    runsByDate.get(run.date).push(run);
  });

  const availableDatesAsc = [...runsByDate.keys()].sort((a, b) => a.localeCompare(b));
  const latestDate = availableDatesAsc[availableDatesAsc.length - 1];
  const today = localIsoDate();
  const defaultDate = runsByDate.has(today) ? today : latestDate;
  let currentIndex = availableDatesAsc.indexOf(defaultDate);

  const applyCurrentDate = (keepTab = true) => {
    const currentDate = availableDatesAsc[currentIndex];
    const runsOnDate = runsByDate.get(currentDate) || [];
    label.textContent = formatDate(currentDate);
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= availableDatesAsc.length - 1;
    todayBtn.disabled = !runsByDate.has(today) || currentDate === today;
    if (onRunsSelected) {
      onRunsSelected(runsOnDate, keepTab);
    }
    return runsOnDate;
  };

  prevBtn.addEventListener("click", () => {
    if (currentIndex <= 0) {
      return;
    }
    currentIndex -= 1;
    applyCurrentDate(true);
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex >= availableDatesAsc.length - 1) {
      return;
    }
    currentIndex += 1;
    applyCurrentDate(true);
  });

  todayBtn.addEventListener("click", () => {
    if (!runsByDate.has(today)) {
      return;
    }
    currentIndex = availableDatesAsc.indexOf(today);
    applyCurrentDate(true);
  });

  const selectedRuns = applyCurrentDate(false);
  return selectedRuns.length ? selectedRuns : [runs[0]];
}

function renderHome(data) {
  const runs = sortRunsDesc(data.runs || []);
  const tabController = initTabBehavior();
  initCardExpandBehavior();

  const applyRunsToFeed = (selectedRuns, keepActiveTab = false) => {
    const normalized = normalizeHomeData(data, selectedRuns);
    tabController.setTabs(normalized.tabs, keepActiveTab);
  };

  const selectedRuns =
    initRunDateControls(runs, (runsOnDate, keepTab = true) => applyRunsToFeed(runsOnDate, keepTab)) ||
    runs.filter((run) => Array.isArray(run.articles) && run.articles.length > 0) ||
    [runs[0]];
  if (!selectedRuns.length) {
    renderFeedItems([]);
    return;
  }
  applyRunsToFeed(selectedRuns, false);
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
