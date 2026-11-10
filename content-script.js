// This script is injected on demand when the user presses the shortcut. Everything lives inside
// one function so injecting it again (for example, into a tab that still holds an orphaned copy
// from before the extension was updated) doesn't redeclare top-level constants.
start_command_bar_host();

function start_command_bar_host() {
  const host_element_name = "arc-command-bar";
  const command_bar_url = chrome.runtime.getURL("command-bar.html");
  const extension_origin = new URL(command_bar_url).origin;
  const instance_id = crypto.randomUUID();
  let host_element = null;
  let iframe_element = null;
  let previously_focused_element = null;
  let is_open = false;

  // The newest injected copy takes over from any older copy running in the same page.
  globalThis.arc_command_bar_instance_id = instance_id;
  remove_existing_hosts();
  chrome.runtime.onMessage.addListener(handle_runtime_message);
  open_command_bar();

  function handle_runtime_message(message, sender, send_response) {
    if (!is_current_instance()) {
      chrome.runtime.onMessage.removeListener(handle_runtime_message);
      return;
    }

    if (message.type === "arc_command_bar_toggle") {
      toggle_command_bar();
      send_response({
        ok: true,
      });
      return;
    }

    if (message.type === "arc_command_bar_hide") {
      close_command_bar();
      send_response({
        ok: true,
      });
    }
  }

  function is_current_instance() {
    return globalThis.arc_command_bar_instance_id === instance_id;
  }

  function toggle_command_bar() {
    if (is_open) {
      close_command_bar();
      post_to_command_bar("arc_command_bar_close");
      return;
    }

    open_command_bar();
  }

  function open_command_bar() {
    const is_new_host = ensure_host();

    previously_focused_element = document.activeElement;
    is_open = true;
    set_host_style("display", "block");
    document.addEventListener("focusin", handle_page_focus_in, true);
    iframe_element.focus();

    // A new iframe opens itself once it loads.
    if (!is_new_host) {
      post_to_command_bar("arc_command_bar_open");
    }
  }

  function close_command_bar() {
    if (!is_open) {
      return;
    }

    is_open = false;
    set_host_style("display", "none");
    document.removeEventListener("focusin", handle_page_focus_in, true);
    restore_page_focus();
  }

  // Close the command bar if the page moves focus to one of its own elements.
  function handle_page_focus_in(event) {
    if (event.target === host_element) {
      return;
    }

    close_command_bar();
    post_to_command_bar("arc_command_bar_close");
  }

  function restore_page_focus() {
    const element = previously_focused_element;
    previously_focused_element = null;

    if (!element || element === document.body || !element.isConnected || typeof element.focus !== "function") {
      return;
    }

    element.focus({
      preventScroll: true,
    });
  }

  function post_to_command_bar(type) {
    iframe_element?.contentWindow?.postMessage({ type }, extension_origin);
  }

  // Returns true when a new iframe was created.
  function ensure_host() {
    if (host_element?.isConnected) {
      return false;
    }

    if (host_element) {
      // The page removed the host element, so put it back. The iframe reloads and opens itself.
      document.documentElement.append(host_element);
      return true;
    }

    host_element = document.createElement(host_element_name);
    set_host_style("all", "initial");
    set_host_style("display", "none");
    set_host_style("position", "fixed");
    set_host_style("inset", "0");
    set_host_style("z-index", "2147483647");
    set_host_style("color-scheme", "dark");

    // A closed shadow root keeps the page's CSS away from the iframe.
    const shadow_root = host_element.attachShadow({
      mode: "closed",
    });

    // The UI runs in an extension page inside this iframe, so the page can't read the user's
    // tabs, history results, or what they type.
    iframe_element = document.createElement("iframe");
    iframe_element.src = command_bar_url;
    iframe_element.title = "Arc Command Bar";
    iframe_element.style.setProperty("background", "transparent", "important");
    iframe_element.style.setProperty("border", "0", "important");
    // Must match the color scheme in command-bar.css, or Chrome hides the page behind an opaque backdrop.
    iframe_element.style.setProperty("color-scheme", "dark", "important");
    iframe_element.style.setProperty("display", "block", "important");
    iframe_element.style.setProperty("height", "100%", "important");
    iframe_element.style.setProperty("width", "100%", "important");

    shadow_root.append(iframe_element);
    document.documentElement.append(host_element);
    watch_for_iframe_removal(shadow_root);

    return true;
  }

  // If something removes the iframe (another extension, for example), close the command bar so
  // the empty, invisible host doesn't keep blocking clicks on the page. The next open rebuilds it.
  function watch_for_iframe_removal(shadow_root) {
    const observer = new MutationObserver(function handle_shadow_root_change() {
      if (iframe_element.isConnected) {
        return;
      }

      observer.disconnect();
      close_command_bar();
      host_element.remove();
      host_element = null;
      iframe_element = null;
    });

    observer.observe(shadow_root, {
      childList: true,
    });
  }

  function set_host_style(property, value) {
    host_element.style.setProperty(property, value, "important");
  }

  function remove_existing_hosts() {
    for (const element of document.querySelectorAll(host_element_name)) {
      element.remove();
    }
  }
}
