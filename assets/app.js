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

function createArticleCard(article) {
  return `
    <article class="article-card">
      <img src="${article.image.src}" alt="${article.image.alt}" />
      <div class="article-copy">
        <div class="article-meta">
          <span>${article.journal}</span>
          <span>${article.quartile}</span>
          <span>${formatDate(article.publishedAt)}</span>
        </div>
        <h3>${article.title}</h3>
        <p>${article.summary}</p>
        <a class="text-link" href="${article.link}" target="_blank" rel="noreferrer">Open paper</a>
      </div>
    </article>
  `;
}

function renderHome(data) {
  const latestRun = data.runs[0];
  document.getElementById("total-runs").textContent = String(data.runs.length);
  document.getElementById("latest-title").textContent = latestRun.title;
  document.getElementById("latest-link").href = resolveRunPath(latestRun.page);

  document.getElementById("latest-run").innerHTML = `
    <div class="run-highlight-copy">
      <div class="run-meta">
        <span>${latestRun.slot}</span>
        <span>${formatDate(latestRun.date)}</span>
        <span>${latestRun.articleCount} articles</span>
      </div>
      <h3>${latestRun.title}</h3>
      <p>${latestRun.summary}</p>
      <div class="tag-row">
        ${latestRun.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <a class="button button-solid" href="${resolveRunPath(latestRun.page)}">Read this digest</a>
    </div>
    <img class="run-hero-image" src="${latestRun.heroImage.src}" alt="${latestRun.heroImage.alt}" />
  `;

  document.getElementById("latest-articles").innerHTML = latestRun.articles
    .slice(0, 6)
    .map(createArticleCard)
    .join("");
}

function renderArchive(data) {
  document.getElementById("archive-list").innerHTML = data.runs
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
