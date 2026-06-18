const arc_command_bar_id = "arc-command-bar-root";
const search_input_id = "arc-command-bar-search-input";

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

let host_element = null;
let shadow_root = null;
let command_bar_element = null;
let input_element = null;
let results_element = null;
let site_search_badge_element = null;
let is_pointer_down_inside_command_bar = false;
let state = {
  is_open: false,
  query: "",
  results: [],
  selected_index: 0,
  site_search_provider: null,
  request_id: 0,
};

chrome.runtime.onMessage.addListener(function handle_runtime_message(message) {
  if (message.type === "arc_command_bar_toggle") {
    toggle_command_bar();
  }
});

function toggle_command_bar() {
  if (state.is_open) {
    close_command_bar();
    return;
  }

  open_command_bar();
}

async function open_command_bar() {
  ensure_command_bar();

  state = {
    ...state,
    is_open: true,
    query: "",
    results: [],
    selected_index: 0,
    site_search_provider: null,
  };

  host_element.hidden = false;
  add_page_key_event_listeners();
  input_element.value = "";
  input_element.placeholder = "Search or enter URL...";
  update_site_search_badge();
  render_results();
  focus_input_without_scrolling();

  await load_recent_tabs();
}

function close_command_bar() {
  if (!state.is_open || !host_element) {
    return;
  }

  close_command_bar_immediately();
}

function close_command_bar_immediately() {
  state = {
    ...state,
    is_open: false,
    query: "",
    results: [],
    selected_index: 0,
    site_search_provider: null,
  };

  remove_page_key_event_listeners();

  if (shadow_root?.activeElement) {
    shadow_root.activeElement.blur();
  }

  if (document.activeElement === host_element) {
    host_element.blur();
  }

  host_element.hidden = true;
  input_element.value = "";
  input_element.placeholder = "Search or enter URL...";
}

function ensure_command_bar() {
  if (host_element) {
    return;
  }

  host_element = document.createElement("div");
  host_element.id = arc_command_bar_id;
  host_element.hidden = true;
  shadow_root = host_element.attachShadow({
    mode: "open",
  });
  shadow_root.addEventListener("keydown", handle_command_bar_key_down);
  shadow_root.addEventListener("keypress", stop_command_bar_key_event);
  shadow_root.addEventListener("keyup", stop_command_bar_key_event);

  const stylesheet_link = document.createElement("link");
  stylesheet_link.rel = "stylesheet";
  stylesheet_link.href = chrome.runtime.getURL("command-bar.css");

  const overlay_element = document.createElement("div");
  overlay_element.className = "arc-command-bar-overlay";
  overlay_element.addEventListener("mousedown", handle_overlay_mouse_down);

  command_bar_element = document.createElement("section");
  command_bar_element.className = "arc-command-bar";
  command_bar_element.setAttribute("role", "dialog");
  command_bar_element.setAttribute("aria-modal", "true");
  command_bar_element.addEventListener("pointerdown", handle_command_bar_pointer_down, true);
  command_bar_element.addEventListener(
    "mousedown",
    function stop_panel_mouse_down(event) {
      event.stopPropagation();
    },
  );

  const search_area_element = create_search_area();
  results_element = document.createElement("div");
  results_element.className = "arc-command-bar-results";
  results_element.setAttribute("role", "listbox");

  command_bar_element.append(search_area_element, results_element);
  overlay_element.append(command_bar_element);
  shadow_root.append(stylesheet_link, overlay_element);
  document.documentElement.append(host_element);
}

function create_search_area() {
  const search_area_element = document.createElement("div");
  search_area_element.className = "arc-command-bar-search-area";

  const search_icon_element = document.createElement("span");
  search_icon_element.className = "arc-command-bar-search-icon";
  search_icon_element.innerHTML = get_magnifying_glass_svg();
  search_icon_element.setAttribute("aria-hidden", "true");

  site_search_badge_element = document.createElement("span");
  site_search_badge_element.className = "arc-command-bar-site-badge";
  site_search_badge_element.hidden = true;

  input_element = document.createElement("input");
  input_element.id = search_input_id;
  input_element.name = "arc-command-bar-search";
  input_element.className = "arc-command-bar-input";
  input_element.type = "text";
  input_element.autocomplete = "off";
  input_element.autocapitalize = "off";
  input_element.spellcheck = false;
  input_element.placeholder = "Search or enter URL...";
  input_element.addEventListener("input", handle_input);
  input_element.addEventListener("keydown", handle_input_key_down, true);
  input_element.addEventListener("blur", handle_input_blur);

  const label_element = document.createElement("label");
  label_element.className = "arc-command-bar-sr-only";
  label_element.htmlFor = search_input_id;
  label_element.textContent = "Search or enter URL";

  search_area_element.append(
    search_icon_element,
    site_search_badge_element,
    label_element,
    input_element
  );

  return search_area_element;
}

function handle_input_key_down(event) {
  if (!state.is_open) {
    return;
  }

  if (is_escape_key(event)) {
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    close_command_bar_from_key_event(event);
  }
}

function handle_input_blur() {
  requestAnimationFrame(function close_after_escape_blur() {
    if (!state.is_open || is_pointer_down_inside_command_bar || is_focus_inside_command_bar()) {
      return;
    }

    close_command_bar_immediately();
  });
}

function handle_command_bar_pointer_down() {
  is_pointer_down_inside_command_bar = true;

  window.addEventListener("pointerup", clear_command_bar_pointer_down, {
    once: true,
    capture: true,
  });
}

function clear_command_bar_pointer_down() {
  setTimeout(function clear_pointer_flag() {
    is_pointer_down_inside_command_bar = false;
  }, 0);
}

function is_focus_inside_command_bar() {
  const active_element = shadow_root?.activeElement;

  return Boolean(active_element && active_element !== shadow_root);
}

async function load_recent_tabs() {
  let response = null;

  try {
    response = await send_message({
      type: "arc_command_bar_recent_tabs",
    });
  } catch (error) {
    response = {
      items: [],
    };
  }

  if (!state.is_open || state.query) {
    return;
  }

  state = {
    ...state,
    results: response.items || [],
    selected_index: 0,
  };

  render_results();
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

async function search_items(query) {
  const request_id = state.request_id + 1;

  state = {
    ...state,
    request_id,
  };

  let response = null;

  try {
    response = await send_message({
      type: "arc_command_bar_search",
      query,
    });
  } catch (error) {
    response = {
      items: [],
    };
  }

  if (
    !state.is_open ||
    state.request_id !== request_id ||
    state.site_search_provider
  ) {
    return;
  }

  state = {
    ...state,
    results: response.items || [],
    selected_index: 0,
  };

  render_results();
}

function handle_command_bar_key_down(event) {
  if (!state.is_open) {
    return;
  }

  event.stopPropagation();

  if (is_escape_key(event)) {
    close_command_bar_from_key_event(event);
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
    maybe_start_site_search(event);
  }
}

function stop_command_bar_key_event(event) {
  if (!state.is_open) {
    return;
  }

  event.stopPropagation();
}

function add_page_key_event_listeners() {
  document.addEventListener("keydown", handle_page_key_event, true);
  document.addEventListener("keypress", handle_page_key_event, true);
  document.addEventListener("keyup", handle_page_key_event, true);
  window.addEventListener("keydown", handle_page_key_event, true);
  window.addEventListener("keypress", handle_page_key_event, true);
  window.addEventListener("keyup", handle_page_key_event, true);
}

function remove_page_key_event_listeners() {
  document.removeEventListener("keydown", handle_page_key_event, true);
  document.removeEventListener("keypress", handle_page_key_event, true);
  document.removeEventListener("keyup", handle_page_key_event, true);
  window.removeEventListener("keydown", handle_page_key_event, true);
  window.removeEventListener("keypress", handle_page_key_event, true);
  window.removeEventListener("keyup", handle_page_key_event, true);
}

function handle_page_key_event(event) {
  if (!state.is_open) {
    return;
  }

  if (is_escape_key(event)) {
    close_command_bar_from_key_event(event);
    return;
  }

  if (!is_command_bar_event(event)) {
    event.preventDefault();
    event.stopPropagation();

    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }
}

function is_command_bar_event(event) {
  if (typeof event.composedPath !== "function") {
    return false;
  }

  return event.composedPath().includes(host_element);
}

function focus_input_without_scrolling() {
  const scroll_x = window.scrollX;
  const scroll_y = window.scrollY;

  try {
    input_element.focus({
      preventScroll: true,
    });
  } catch (error) {
    input_element.focus();
  }

  window.scrollTo(scroll_x, scroll_y);
  requestAnimationFrame(function restore_scroll_position() {
    window.scrollTo(scroll_x, scroll_y);
  });
}

function close_command_bar_from_key_event(event) {
  event.preventDefault();
  event.stopPropagation();
  event.cancelBubble = true;

  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }

  close_command_bar_immediately();
}

function is_escape_key(event) {
  return event.key === "Escape" || event.key === "Esc" || event.code === "Escape" || event.keyCode === 27 || event.which === 27;
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

  input_element.value = "";
  input_element.placeholder = "Search or enter URL...";
  update_site_search_badge();
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

function maybe_start_site_search(event) {
  if (state.site_search_provider) {
    return;
  }

  const provider = get_matching_site_search_provider(state.query);

  if (!provider) {
    return;
  }

  event.preventDefault();

  state = {
    ...state,
    site_search_provider: provider,
    query: "",
    results: [],
    selected_index: 0,
  };

  input_element.value = "";
  input_element.placeholder = "Search...";
  update_site_search_badge();
  render_site_search_results();
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

  state = {
    ...state,
    results: [
      {
        kind: "site-search",
        title,
        query,
        url: provider.build_url(query),
        provider_name: provider.name,
        provider_icon: provider.icon,
      },
    ],
    selected_index: 0,
  };

  render_results();
}

function render_results() {
  results_element.textContent = "";

  const fragment = document.createDocumentFragment();

  state.results.forEach(function append_result(item, index) {
    const result_element = create_result_element(item, index);
    fragment.append(result_element);
  });

  results_element.append(fragment);
}

function create_result_element(item, index) {
  const result_element = document.createElement("button");
  result_element.type = "button";
  result_element.className = "arc-command-bar-result";
  result_element.setAttribute("role", "option");
  result_element.setAttribute(
    "aria-selected",
    String(index === state.selected_index),
  );
  result_element.addEventListener("click", function handle_click() {
    activate_item(item);
  });

  const favicon_element = create_result_icon(item);
  const title_element = document.createElement("span");
  title_element.className = "arc-command-bar-result-title";
  title_element.textContent = get_result_title(item);

  result_element.append(favicon_element, title_element);

  const subtitle = get_result_subtitle(item);

  if (subtitle) {
    const subtitle_element = document.createElement("span");
    subtitle_element.className = "arc-command-bar-result-subtitle";
    subtitle_element.textContent = subtitle;
    result_element.append(subtitle_element);
  }

  const action_element = create_result_action(item);

  if (action_element) {
    result_element.append(action_element);
  }

  return result_element;
}

function create_result_icon(item) {
  if (item.kind === "search") {
    return create_search_icon();
  }

  if (item.kind === "url") {
    return create_globe_icon();
  }

  if (item.kind === "site-search") {
    return create_symbol_icon(item.provider_icon || "⌕", "site");
  }

  const favicon_url = get_favicon_url(item.url);

  if (!favicon_url) {
    return create_globe_icon();
  }

  const icon_element = document.createElement("img");
  icon_element.className = "arc-command-bar-favicon";
  icon_element.alt = "";
  icon_element.src = favicon_url;
  icon_element.addEventListener("error", function handle_favicon_error() {
    icon_element.replaceWith(create_globe_icon());
  });

  return icon_element;
}

function create_globe_icon() {
  const icon_element = document.createElement("span");
  icon_element.className = "arc-command-bar-globe-icon";
  icon_element.setAttribute("aria-hidden", "true");
  icon_element.innerHTML = [
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    '<path d="M3 12h18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    '<path d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
    "</svg>",
  ].join("");

  return icon_element;
}

function create_search_icon() {
  const icon_element = document.createElement("span");
  icon_element.className = "arc-command-bar-symbol-icon arc-command-bar-symbol-icon-search";
  icon_element.setAttribute("aria-hidden", "true");
  icon_element.innerHTML = get_magnifying_glass_svg();

  return icon_element;
}

function get_magnifying_glass_svg() {
  return [
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    '<path d="M15.4 15.4 21 21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    "</svg>",
  ].join("");
}

function update_selected_result_elements() {
  const result_elements = [
    ...results_element.querySelectorAll(".arc-command-bar-result"),
  ];

  result_elements.forEach(
    function update_result_element(result_element, index) {
      result_element.setAttribute(
        "aria-selected",
        String(index === state.selected_index),
      );
    },
  );
}

function scroll_selected_result_into_view() {
  const selected_element = results_element.querySelector(
    '.arc-command-bar-result[aria-selected="true"]',
  );

  if (!selected_element) {
    return;
  }

  selected_element.scrollIntoView({
    block: "nearest",
  });
}

function create_symbol_icon(symbol, variant) {
  const icon_element = document.createElement("span");
  icon_element.className = `arc-command-bar-symbol-icon arc-command-bar-symbol-icon-${variant}`;
  icon_element.textContent = symbol;
  icon_element.setAttribute("aria-hidden", "true");

  return icon_element;
}

function create_result_action(item) {
  if (item.kind !== "tab") {
    return null;
  }

  const action_element = document.createElement("span");
  action_element.className = "arc-command-bar-result-action";

  const label_element = document.createElement("span");
  label_element.className = "arc-command-bar-action-label";
  label_element.textContent = "Switch to Tab";

  const arrow_element = document.createElement("span");
  arrow_element.className = "arc-command-bar-action-arrow";
  arrow_element.innerHTML = get_arrow_right_svg();
  arrow_element.setAttribute("aria-hidden", "true");

  action_element.append(label_element, arrow_element);

  return action_element;
}

function get_arrow_right_svg() {
  return [
    '<svg viewBox="0 0 24 24" focusable="false">',
    '<path d="M5 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    '<path d="m13 8 4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    "</svg>",
  ].join("");
}

function get_result_title(item) {
  if (item.kind === "search") {
    return item.title;
  }

  return item.title || item.url || "";
}

function get_result_subtitle(item) {
  if (item.kind === "tab") {
    return "";
  }

  if (
    item.kind === "search" ||
    item.kind === "url" ||
    item.kind === "site-search"
  ) {
    return "";
  }

  return get_display_domain(item.url);
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
    focus_input_without_scrolling();
    return;
  }

  close_command_bar();

  await send_message({
    type: "arc_command_bar_activate",
    item,
  });
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

function handle_overlay_mouse_down(event) {
  if (event.target === event.currentTarget) {
    close_command_bar();
  }
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

function get_favicon_url(url) {
  try {
    const url_object = new URL(url);

    return `https://www.google.com/s2/favicons?domain=${url_object.hostname}&sz=16`;
  } catch (error) {
    return "";
  }
}

function get_display_domain(url) {
  try {
    const url_object = new URL(url);

    return url_object.hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

async function send_message(message) {
  const response = await chrome.runtime.sendMessage(message);

  if (!response?.ok) {
    throw new Error(response?.error || "Command bar request failed.");
  }

  return response;
}
