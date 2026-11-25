const default_placeholder = "Search or enter URL...";
const site_search_placeholder = "Search...";

const site_search_providers = [
  {
    key: "youtube",
    name: "YouTube",
    icon: "▶",
    build_url: function build_youtube_url(query) {
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    },
  },
  {
    key: "amazon",
    name: "Amazon",
    icon: "a",
    build_url: function build_amazon_url(query) {
      return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    },
  },
  {
    key: "wikipedia",
    name: "Wikipedia",
    icon: "W",
    build_url: function build_wikipedia_url(query) {
      return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;
    },
  },
  {
    key: "x",
    aliases: ["twitter"],
    name: "X",
    icon: "𝕏",
    build_url: function build_x_url(query) {
      return `https://x.com/search?q=${encodeURIComponent(query)}`;
    },
  },
  {
    key: "spotify",
    name: "Spotify",
    icon: "♬",
    build_url: function build_spotify_url(query) {
      return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    },
  },
];

// The same page is shown in an iframe on normal web pages and as the toolbar popup on pages
// that don't allow extensions to inject content, such as chrome:// pages and the New Tab page.
const is_popup = window.parent === window;

const overlay_element = document.getElementById("arc-command-bar-overlay");
const command_bar_element = document.getElementById("arc-command-bar");
const input_element = document.getElementById("arc-command-bar-search-input");
const results_element = document.getElementById("arc-command-bar-results");
const site_search_badge_element = document.getElementById("arc-command-bar-site-badge");

let state = {
  is_open: false,
  query: "",
  results: [],
  selected_index: 0,
  site_search_provider: null,
  request_id: 0,
};

initialize_command_bar();

function initialize_command_bar() {
  document.documentElement.classList.toggle("is-popup", is_popup);
  overlay_element.addEventListener("mousedown", handle_overlay_mouse_down);
  command_bar_element.addEventListener("mousedown", keep_focus_in_input);
  input_element.addEventListener("input", handle_input);
  document.addEventListener("keydown", handle_key_down);
  window.addEventListener("message", handle_window_message);

  if (is_popup) {
    chrome.runtime.onMessage.addListener(handle_runtime_message);
  }

  open_command_bar();
}

function handle_window_message(event) {
  // Only the content script in the embedding page decides when the command bar opens and closes.
  if (event.source !== window.parent) {
    return;
  }

  if (event.data?.type === "arc_command_bar_open") {
    open_command_bar();
    return;
  }

  if (event.data?.type === "arc_command_bar_close") {
    hide_command_bar();
  }
}

function handle_runtime_message(message) {
  if (message.type === "arc_command_bar_close_popup") {
    window.close();
  }
}

async function open_command_bar() {
  reset_state(true);
  document.body.hidden = false;
  reset_input();
  render_results();
  focus_input();

  await load_recent_tabs();
}

async function close_command_bar() {
  if (!state.is_open) {
    return;
  }

  hide_command_bar();

  if (is_popup) {
    window.close();
    return;
  }

  try {
    await send_message({
      type: "arc_command_bar_close",
    });
  } catch (error) {
    console.error("Arc Command Bar could not close.", error);
  }
}

function hide_command_bar() {
  reset_state(false);
  document.body.hidden = true;
  reset_input();
  render_results();
}

function reset_state(is_open) {
  state = {
    ...state,
    is_open,
    query: "",
    results: [],
    selected_index: 0,
    site_search_provider: null,
  };
}

function reset_input() {
  input_element.value = "";
  input_element.placeholder = default_placeholder;
  update_site_search_badge();
}

function focus_input() {
  input_element.focus({
    preventScroll: true,
  });
}

// Clicking anywhere inside the panel keeps the cursor in the search input, so keyboard
// navigation keeps working after a mouse click.
function keep_focus_in_input(event) {
  event.stopPropagation();

  if (event.target !== input_element) {
    event.preventDefault();
  }
}

function handle_overlay_mouse_down(event) {
  if (event.target === event.currentTarget) {
    close_command_bar();
  }
}

async function handle_input() {
  const query = input_element.value;

  state = {
    ...state,
    query,
    selected_index: 0,
  };

  if (state.site_search_provider) {
    render_site_search_results();
    return;
  }

  if (!query.trim()) {
    await load_recent_tabs();
    return;
  }

  await search_items(query);
}

async function load_recent_tabs() {
  const request_id = start_request();
  const items = await request_items({
    type: "arc_command_bar_recent_tabs",
  });

  if (!is_latest_request(request_id) || state.query.trim() || state.site_search_provider) {
    return;
  }

  show_results(items);
}

async function search_items(query) {
  const request_id = start_request();
  const items = await request_items({
    type: "arc_command_bar_search",
    query,
  });

  if (!is_latest_request(request_id) || state.site_search_provider) {
    return;
  }

  show_results(items);
}

// Each request gets an id so a slow response can't overwrite the results of a newer one.
function start_request() {
  const request_id = state.request_id + 1;

  state = {
    ...state,
    request_id,
  };

  return request_id;
}

function is_latest_request(request_id) {
  return state.is_open && state.request_id === request_id;
}

async function request_items(message) {
  try {
    const response = await send_message(message);

    return response.items || [];
  } catch (error) {
    console.error("Arc Command Bar could not load results.", error);

    return [];
  }
}

function show_results(items) {
  state = {
    ...state,
    results: items,
    selected_index: 0,
  };

  render_results();
}

function handle_key_down(event) {
  if (!state.is_open || event.isComposing) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    close_command_bar();
    return;
  }

  if (event.key === "Backspace" && should_exit_site_search()) {
    event.preventDefault();
    exit_site_search();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    move_selection(1);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    move_selection(-1);
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    activate_selected_item();
    return;
  }

  if (event.key === "Tab") {
    // Tab never moves focus out of the search input; it only starts a site search.
    event.preventDefault();
    maybe_start_site_search();
  }
}

function should_exit_site_search() {
  return Boolean(state.site_search_provider) && input_element.value.length === 0;
}

function exit_site_search() {
  state = {
    ...state,
    query: "",
    results: [],
    selected_index: 0,
    site_search_provider: null,
  };

  reset_input();
  load_recent_tabs();
}

function move_selection(delta) {
  if (!state.results.length) {
    return;
  }

  const last_index = state.results.length - 1;
  const selected_index = state.selected_index + delta;

  state = {
    ...state,
    selected_index: Math.max(0, Math.min(last_index, selected_index)),
  };

  update_selected_result_elements();
  scroll_selected_result_into_view();
}

function maybe_start_site_search() {
  if (state.site_search_provider) {
    return;
  }

  const provider = get_matching_site_search_provider(state.query);

  if (!provider) {
    return;
  }

  state = {
    ...state,
    site_search_provider: provider,
    query: "",
    results: [],
    selected_index: 0,
  };

  input_element.value = "";
  input_element.placeholder = site_search_placeholder;
  update_site_search_badge();
  render_site_search_results();
}

function get_matching_site_search_provider(query) {
  const normalized_query = query.trim().toLowerCase();

  if (!normalized_query) {
    return null;
  }

  return (
    site_search_providers.find(function provider_matches(provider) {
      const aliases = provider.aliases || [];

      return (
        provider.key.startsWith(normalized_query) ||
        aliases.some(function alias_matches(alias) {
          return alias.startsWith(normalized_query);
        })
      );
    }) || null
  );
}

function render_site_search_results() {
  const query = state.query.trim();
  const provider = state.site_search_provider;

  if (!provider) {
    return;
  }

  const title = query
    ? `${provider.name}: ${query}`
    : `Search ${provider.name}`;

  show_results([
    {
      kind: "site-search",
      title,
      query,
      url: provider.build_url(query),
      provider_name: provider.name,
      provider_icon: provider.icon,
    },
  ]);
}

function update_site_search_badge() {
  const provider = state.site_search_provider;

  if (!provider) {
    site_search_badge_element.hidden = true;
    site_search_badge_element.textContent = "";
    return;
  }

  site_search_badge_element.hidden = false;
  site_search_badge_element.textContent = provider.name;
}

function render_results() {
  const fragment = document.createDocumentFragment();

  state.results.forEach(function append_result(item, index) {
    fragment.append(create_result_element(item, index));
  });

  results_element.replaceChildren(fragment);
  update_active_descendant();
}

function create_result_element(item, index) {
  const result_element = document.createElement("button");
  result_element.type = "button";
  result_element.id = get_result_element_id(index);
  result_element.tabIndex = -1;
  result_element.className = "arc-command-bar-result";
  result_element.setAttribute("role", "option");
  result_element.setAttribute("aria-selected", String(index === state.selected_index));
  result_element.addEventListener("click", function handle_click() {
    activate_item(item);
  });

  const title_element = document.createElement("span");
  title_element.className = "arc-command-bar-result-title";
  title_element.textContent = get_result_title(item);

  result_element.append(create_result_icon(item), title_element);

  const subtitle = get_result_subtitle(item);

  if (subtitle) {
    const subtitle_element = document.createElement("span");
    subtitle_element.className = "arc-command-bar-result-subtitle";
    subtitle_element.textContent = subtitle;
    result_element.append(subtitle_element);
  }

  if (item.kind === "tab") {
    result_element.append(create_switch_to_tab_action());
  }

  return result_element;
}

function get_result_element_id(index) {
  return `arc-command-bar-result-${index}`;
}

function create_result_icon(item) {
  if (item.kind === "search") {
    return create_icon_from_template("arc-command-bar-search-icon-template");
  }

  if (item.kind === "url") {
    return create_icon_from_template("arc-command-bar-globe-icon-template");
  }

  if (item.kind === "site-search") {
    return create_symbol_icon(item.provider_icon || "⌕");
  }

  const favicon_url = get_favicon_url(item.url);

  if (!favicon_url) {
    return create_icon_from_template("arc-command-bar-globe-icon-template");
  }

  const icon_element = document.createElement("img");
  icon_element.className = "arc-command-bar-favicon";
  icon_element.alt = "";
  icon_element.src = favicon_url;
  icon_element.addEventListener("error", function handle_favicon_error() {
    icon_element.replaceWith(create_icon_from_template("arc-command-bar-globe-icon-template"));
  });

  return icon_element;
}

function create_icon_from_template(template_id) {
  return document.getElementById(template_id).content.firstElementChild.cloneNode(true);
}

function create_symbol_icon(symbol) {
  const icon_element = document.createElement("span");
  icon_element.className = "arc-command-bar-symbol-icon arc-command-bar-symbol-icon-site";
  icon_element.textContent = symbol;
  icon_element.setAttribute("aria-hidden", "true");

  return icon_element;
}

function create_switch_to_tab_action() {
  const action_element = document.createElement("span");
  action_element.className = "arc-command-bar-result-action";

  const label_element = document.createElement("span");
  label_element.className = "arc-command-bar-action-label";
  label_element.textContent = "Switch to Tab";

  action_element.append(label_element, create_icon_from_template("arc-command-bar-arrow-icon-template"));

  return action_element;
}

// Favicons come from Chrome's local favicon cache, so no browsing data leaves the device.
function get_favicon_url(url) {
  if (!url) {
    return "";
  }

  const favicon_url = new URL(chrome.runtime.getURL("/_favicon/"));
  favicon_url.searchParams.set("pageUrl", url);
  favicon_url.searchParams.set("size", "32");

  return favicon_url.href;
}

function get_result_title(item) {
  if (item.kind === "search") {
    return item.title;
  }

  return item.title || item.url || "";
}

function get_result_subtitle(item) {
  if (item.kind === "tab" || item.kind === "search" || item.kind === "url" || item.kind === "site-search") {
    return "";
  }

  return get_display_domain(item.url);
}

function get_display_domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function update_selected_result_elements() {
  const result_elements = [...results_element.querySelectorAll(".arc-command-bar-result")];

  result_elements.forEach(function update_result_element(result_element, index) {
    result_element.setAttribute("aria-selected", String(index === state.selected_index));
  });

  update_active_descendant();
}

function update_active_descendant() {
  if (!state.results.length) {
    input_element.removeAttribute("aria-activedescendant");
    return;
  }

  input_element.setAttribute("aria-activedescendant", get_result_element_id(state.selected_index));
}

function scroll_selected_result_into_view() {
  const selected_element = results_element.querySelector('.arc-command-bar-result[aria-selected="true"]');

  selected_element?.scrollIntoView({
    block: "nearest",
  });
}

async function activate_selected_item() {
  const selected_item = state.results[state.selected_index];

  if (!selected_item) {
    return;
  }

  await activate_item(selected_item);
}

async function activate_item(item) {
  if (item.kind === "site-search" && !item.query.trim()) {
    focus_input();
    return;
  }

  hide_command_bar();

  try {
    await send_message({
      type: "arc_command_bar_activate",
      item,
    });
  } catch (error) {
    console.error("Arc Command Bar could not open the selected result.", error);
  }

  if (is_popup) {
    window.close();
  }
}

async function send_message(message) {
  const response = await chrome.runtime.sendMessage(message);

  if (!response?.ok) {
    throw new Error(response?.error || "Command bar request failed.");
  }

  return response;
}
