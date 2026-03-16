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
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
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

function normalizeHomeData(data) {
  const latestRun = data.runs[0];
  const materials = latestRun.articles.map((article, idx) =>
    toFeedItem(article, idx, "materials", latestRun),
  );
  const techScience = (data.categories?.tech_science || []).map((item, idx) =>
    toFeedItem(item, idx, "tech_science", latestRun),
  );
  const world = (data.categories?.world || []).map((item, idx) =>
    toFeedItem(item, idx, "world", latestRun),
  );

  const forYou = [...materials.slice(0, 6), ...techScience.slice(0, 2), ...world.slice(0, 2)];

  return {
    latestRun,
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

  return `
    <article class="news-card">
      <div class="news-image-wrap">
        <img class="news-image" src="${item.image.src}" alt="${item.image.alt}" loading="lazy" />
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
  const cardCount = document.getElementById("card-count");
  if (!cardsStream || !cardCount) {
    return;
  }

  cardCount.textContent = String(items.length);
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

function initTabBehavior(tabs) {
  const tabsEl = document.getElementById("feed-tabs");
  if (!tabsEl) {
    return;
  }

  let activeTab = "for_you";
  renderFeedItems(tabs[activeTab] || []);

  tabsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) {
      return;
    }

    activeTab = btn.dataset.tab;
    tabsEl.querySelectorAll(".feed-tab").forEach((tabBtn) => {
      tabBtn.classList.toggle("is-active", tabBtn === btn);
    });
    renderFeedItems(tabs[activeTab] || []);
  });
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

function renderHome(data) {
  const normalized = normalizeHomeData(data);
  const latestRunDate = document.getElementById("latest-run-date");
  if (latestRunDate) {
    latestRunDate.textContent = formatDate(normalized.latestRun.date);
  }
  initTabBehavior(normalized.tabs);
  initCardExpandBehavior();
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
