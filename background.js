const max_results = 5;
const max_search_results = 50;
const recency_window = 1000 * 60 * 60 * 24 * 30;

const common_websites = [
  { title: "Google", url: "https://www.google.com/" },
  { title: "Gmail", url: "https://mail.google.com/" },
  { title: "Google Drive", url: "https://drive.google.com/" },
  { title: "Google Calendar", url: "https://calendar.google.com/" },
  { title: "YouTube", url: "https://www.youtube.com/" },
  { title: "Amazon", url: "https://www.amazon.com/" },
  { title: "Wikipedia", url: "https://www.wikipedia.org/" },
  { title: "X", url: "https://x.com/" },
  { title: "Spotify", url: "https://open.spotify.com/" },
  { title: "GitHub", url: "https://github.com/" },
  { title: "Reddit", url: "https://www.reddit.com/" },
  { title: "LinkedIn", url: "https://www.linkedin.com/" }
];

chrome.action.onClicked.addListener(async function handle_action_clicked(tab) {
  await send_toggle_message(tab.id);
});

chrome.runtime.onMessage.addListener(function handle_runtime_message(message, sender, send_response) {
  handle_message(message, sender)
    .then(send_response)
    .catch(function handle_error(error) {
      send_response({
        ok: false,
        error: error.message
      });
    });

  return true;
});

async function send_toggle_message(tab_id) {
  if (!tab_id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab_id, {
      type: "arc_command_bar_toggle"
    });
  } catch (error) {
    // Restricted pages do not accept content scripts or extension messages.
  }
}

async function handle_message(message, sender) {
  if (message.type === "arc_command_bar_recent_tabs") {
    const items = await get_recent_tab_items(sender.tab?.id);

    return {
      ok: true,
      items
    };
  }

  if (message.type === "arc_command_bar_search") {
    const items = await get_search_items(message.query);

    return {
      ok: true,
      items
    };
  }

  if (message.type === "arc_command_bar_activate") {
    await activate_item(message.item, sender.tab?.id);

    return {
      ok: true
    };
  }

  throw new Error("Unknown command bar message.");
}

async function get_recent_tab_items(current_tab_id) {
  const tabs = await chrome.tabs.query({});

  return tabs
    .filter(function keep_tab(tab) {
      return Boolean(tab.id) && tab.id !== current_tab_id && Boolean(tab.url);
    })
    .sort(function sort_recent_tabs(first_tab, second_tab) {
      return (second_tab.lastAccessed || 0) - (first_tab.lastAccessed || 0);
    })
    .slice(0, max_results)
    .map(create_tab_item);
}

async function get_search_items(query) {
  const trimmed_query = query.trim();

  if (!trimmed_query) {
    return [];
  }

  const [tabs, history_items, top_sites] = await Promise.all([
    chrome.tabs.query({}),
    chrome.history.search({
      text: trimmed_query,
      startTime: 0,
      maxResults: 80
    }),
    chrome.topSites.get()
  ]);

  const browser_items = [
    ...tabs.map(create_tab_item),
    ...history_items.map(create_history_item),
    ...top_sites.map(create_top_site_item),
    ...common_websites.map(create_common_site_item)
  ];

  const ranked_items = browser_items
    .map(function add_score(item) {
      return {
        ...item,
        score: score_item(item, trimmed_query)
      };
    })
    .filter(function keep_matched_item(item) {
      return item.score > 0;
    })
    .sort(function sort_items(first_item, second_item) {
      return second_item.score - first_item.score;
    });

  const deduplicated_items = remove_duplicate_items(ranked_items);
  const primary_items = create_primary_query_items(trimmed_query);
  const primary_urls = new Set(primary_items.map(function get_primary_url(item) {
    return normalize_url(item.url);
  }));
  const ranked_primary_items = primary_items.map(function add_primary_score(item) {
    return {
      ...item,
      score: score_primary_item(item, trimmed_query)
    };
  });

  const remaining_items = deduplicated_items
    .filter(function keep_non_primary_duplicate(item) {
      return !primary_urls.has(normalize_url(item.url));
    });

  return [
    ...remaining_items,
    ...ranked_primary_items
  ]
    .sort(function sort_final_items(first_item, second_item) {
      return second_item.score - first_item.score;
    })
    .slice(0, max_search_results);
}

function score_primary_item(item, query) {
  if (item.kind === "url") {
    return 10000;
  }

  if (item.kind === "search") {
    if (is_likely_search_phrase(query)) {
      return 10000;
    }

    return 340;
  }

  return 0;
}

function is_likely_search_phrase(query) {
  return !looks_like_url(query) && /\s/.test(query.trim());
}

async function activate_item(item, current_tab_id) {
  if (item.kind === "tab") {
    await chrome.tabs.update(item.tab_id, {
      active: true
    });

    if (item.window_id) {
      await chrome.windows.update(item.window_id, {
        focused: true
      });
    }

    return;
  }

  if (item.kind === "search") {
    await chrome.search.query({
      text: item.query,
      disposition: "NEW_TAB"
    });

    return;
  }

  if (item.kind === "site-search" || item.kind === "url" || item.kind === "history" || item.kind === "top-site" || item.kind === "common-site") {
    await open_url(item.url);
  }
}

async function open_url(url) {
  await chrome.tabs.create({
    url
  });
}

function create_tab_item(tab) {
  return {
    kind: "tab",
    title: tab.title || tab.url || "Untitled",
    url: tab.url || "",
    tab_id: tab.id,
    window_id: tab.windowId,
    last_accessed: tab.lastAccessed || 0,
    last_visit_time: 0
  };
}

function create_history_item(history_item) {
  return {
    kind: "history",
    title: history_item.title || history_item.url || "Untitled",
    url: history_item.url || "",
    visit_count: history_item.visitCount || 0,
    last_visit_time: history_item.lastVisitTime || 0
  };
}

function create_top_site_item(top_site) {
  return {
    kind: "top-site",
    title: top_site.title || top_site.url || "Untitled",
    url: top_site.url || "",
    last_visit_time: 0
  };
}

function create_common_site_item(common_site) {
  return {
    kind: "common-site",
    title: common_site.title,
    url: common_site.url,
    last_visit_time: 0
  };
}

function create_primary_query_items(query) {
  if (looks_like_url(query)) {
    return [
      {
        kind: "url",
        title: query,
        url: normalize_input_url(query)
      },
      {
        kind: "search",
        title: query,
        query
      }
    ];
  }

  return [
    {
      kind: "search",
      title: query,
      query
    }
  ];
}

function score_item(item, query) {
  const normalized_query = normalize_text(query);
  const normalized_title = normalize_text(item.title);
  const normalized_url = normalize_text(item.url);
  const url_parts = get_url_parts(item.url);
  let score = 0;

  if (normalized_title === normalized_query) {
    score += 120;
  }

  if (normalized_title.startsWith(normalized_query)) {
    score += 90;
  }

  if (query_words_match(normalized_title, normalized_query)) {
    score += 60;
  }

  if (normalized_title.includes(normalized_query)) {
    score += 45;
  }

  if (url_parts.domain.includes(normalized_query)) {
    score += 75;
  }

  if (url_parts.path.includes(normalized_query)) {
    score += 30;
  }

  if (normalized_url.includes(normalized_query)) {
    score += 20;
  }

  if (item.kind === "tab") {
    score += 120;

    if (normalized_title.includes(normalized_query)) {
      score += 120;
    }

    if (url_parts.domain.includes(normalized_query)) {
      score += 180;
    }

    score += Math.max(0, 20 - get_age_in_hours(item.last_accessed) / 6);
  }

  if (item.kind === "history") {
    score += Math.min(20, item.visit_count || 0);
    score += get_recency_bonus(item.last_visit_time);
  }

  if (item.kind === "top-site") {
    score += 15;
  }

  if (item.kind === "common-site") {
    score += 10;
  }

  return score;
}

function remove_duplicate_items(items) {
  const seen_urls = new Set();
  const seen_titles = new Set();
  const deduplicated_items = [];

  for (const item of items) {
    const normalized_item_url = normalize_url(item.url);
    const normalized_item_title = normalize_text(item.title);

    if (seen_urls.has(normalized_item_url) || seen_titles.has(normalized_item_title)) {
      continue;
    }

    seen_urls.add(normalized_item_url);
    seen_titles.add(normalized_item_title);
    deduplicated_items.push(item);
  }

  return deduplicated_items;
}

function looks_like_url(input) {
  const trimmed_input = input.trim();

  if (/^chrome:\/\//i.test(trimmed_input)) {
    return true;
  }

  if (/^https?:\/\//i.test(trimmed_input)) {
    return true;
  }

  if (/\s/.test(trimmed_input)) {
    return false;
  }

  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#:].*)?$/i.test(trimmed_input) || /^localhost(:\d+)?(\/.*)?$/i.test(trimmed_input);
}

function normalize_input_url(input) {
  if (/^chrome:\/\//i.test(input)) {
    return input;
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  return `https://${input}`;
}

function normalize_url(url) {
  if (!url) {
    return "";
  }

  try {
    const url_object = new URL(url);
    url_object.hash = "";

    return url_object.href.replace(/\/$/, "").toLowerCase();
  } catch (error) {
    return url.toLowerCase();
  }
}

function normalize_text(value) {
  return String(value || "").trim().toLowerCase();
}

function query_words_match(text, query) {
  const words = query
    .split(/\s+/)
    .filter(Boolean);

  return words.length > 0 && words.every(function has_word(word) {
    return text.includes(word);
  });
}

function get_url_parts(url) {
  try {
    const url_object = new URL(url);

    return {
      domain: normalize_text(url_object.hostname.replace(/^www\./, "")),
      path: normalize_text(url_object.pathname)
    };
  } catch (error) {
    return {
      domain: "",
      path: ""
    };
  }
}

function get_recency_bonus(last_visit_time) {
  if (!last_visit_time) {
    return 0;
  }

  const age = Date.now() - last_visit_time;

  if (age <= 0) {
    return 20;
  }

  return Math.max(0, 20 * (1 - age / recency_window));
}

function get_age_in_hours(timestamp) {
  if (!timestamp) {
    return 1000;
  }

  return (Date.now() - timestamp) / (1000 * 60 * 60);
}
