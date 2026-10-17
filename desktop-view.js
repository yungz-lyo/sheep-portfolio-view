(() => {
  const data = window.SheepPortfolio;
  const desktop = matchMedia("(min-width: 901px)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const gallery = document.querySelector("#edition-gallery");
  const lightbox = document.querySelector("#edition-lightbox");
  const image = lightbox.querySelector("img");
  let background = "light";
  try { background = localStorage.getItem("sheep-viewer-background-v1") || "light"; } catch { /* Use the default background. */ }
  let groups = [];
  let current = 0;
  let frame = 0;
  let stage = null;
  let pan = null;
  let dragged = false;

  const bar = document.createElement("div");
  bar.className = "desktop-viewbar";
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "作品分类");
  data.projects.forEach((project) => {
    const link = document.createElement("a");
    link.href = `#project/${project.id}`;
    link.textContent = project.title;
    nav.append(link);
  });
  const tools = document.createElement("div");
  tools.className = "desktop-view-tools";
  function button(parent, text, label, action) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = text;
    node.title = label;
    node.setAttribute("aria-label", label);
    node.addEventListener("click", action);
    parent.append(node);
    return node;
  }
  const previous = button(tools, "↑", "上一组图片", () => jump(-1));
  const count = document.createElement("output");
  count.setAttribute("aria-label", "当前图片组");
  tools.append(count);
  const next = button(tools, "↓", "下一组图片", () => jump(1));
  const backgrounds = document.createElement("div");
  backgrounds.className = "desktop-backgrounds";
  backgrounds.setAttribute("role", "group");
  backgrounds.setAttribute("aria-label", "观片背景");
  for (const mode of ["light", "dark"]) {
    const choice = button(backgrounds, "", mode === "light" ? "浅灰背景" : "深灰背景", () => {
      background = mode;
      try { localStorage.setItem("sheep-viewer-background-v1", mode); } catch { /* Keep the current viewing session. */ }
      sync();
    });
    choice.dataset.background = mode;
  }
  tools.append(backgrounds);
  bar.append(nav, tools);
  document.body.append(bar);

  function updateGroup() {
    frame = 0;
    if (!desktop.matches || document.body.classList.contains("at-home")) return;
    const top = bar.getBoundingClientRect().bottom + 36;
    current = groups.reduce((active, group, index) => group.getBoundingClientRect().top <= top ? index : active, 0);
    count.textContent = `${String(groups.length ? current + 1 : 0).padStart(2, "0")} / ${String(groups.length).padStart(2, "0")} 组`;
    previous.disabled = !groups.length || current === 0;
    next.disabled = !groups.length || current === groups.length - 1;
  }
  function jump(direction) {
    const target = groups[Math.max(0, Math.min(groups.length - 1, current + direction))];
    target?.scrollIntoView({ block: "start", behavior: reduced.matches ? "instant" : "smooth" });
  }
  function fit() {
    if (!stage) return;
    stage.classList.remove("is-zoomed", "is-panning");
    if (stage.clientWidth && stage.clientHeight && image.naturalWidth) {
      stage.style.setProperty("--fit-width", `${Math.min(image.naturalWidth, stage.clientWidth, stage.clientHeight * image.naturalWidth / image.naturalHeight)}px`);
    }
    stage.scrollTo(0, 0);
    pan = null;
    zoom.textContent = "+";
    zoom.title = "原尺寸查看";
    zoom.setAttribute("aria-label", "原尺寸查看");
    zoom.setAttribute("aria-pressed", "false");
  }
  function toggleZoom(event) {
    if (!stage || !image.naturalWidth || dragged) return;
    if (stage.classList.contains("is-zoomed")) { fit(); return; }
    const rect = image.getBoundingClientRect();
    const x = event?.target === image ? (event.clientX - rect.left) / rect.width : .5;
    const y = event?.target === image ? (event.clientY - rect.top) / rect.height : .5;
    stage.style.setProperty("--image-width", `${image.naturalWidth}px`);
    stage.classList.add("is-zoomed");
    stage.scrollLeft = image.naturalWidth * x - stage.clientWidth / 2;
    stage.scrollTop = image.naturalHeight * y - stage.clientHeight / 2;
    zoom.textContent = "−";
    zoom.title = "适应窗口";
    zoom.setAttribute("aria-label", "适应窗口");
    zoom.setAttribute("aria-pressed", "true");
  }
  const zoom = button(lightbox, "+", "原尺寸查看", toggleZoom);
  zoom.className = "desktop-zoom";
  image.draggable = false;
  image.addEventListener("click", toggleZoom);
  image.addEventListener("load", fit);
  lightbox.addEventListener("close", fit);
  lightbox.addEventListener("pointerdown", (event) => {
    if (event.target !== image || !stage?.classList.contains("is-zoomed") || event.button !== 0) return;
    dragged = false;
    pan = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop, id: event.pointerId };
  });
  lightbox.addEventListener("pointermove", (event) => {
    if (!pan) return;
    if (!dragged && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) > 5) {
      dragged = true;
      stage.setPointerCapture(pan.id);
      stage.classList.add("is-panning");
    }
    if (!dragged) return;
    event.preventDefault();
    stage.scrollLeft = pan.left + pan.x - event.clientX;
    stage.scrollTop = pan.top + pan.y - event.clientY;
  });
  function endPan() {
    if (!pan) return;
    if (stage?.hasPointerCapture(pan.id)) stage.releasePointerCapture(pan.id);
    stage?.classList.remove("is-panning");
    pan = null;
    setTimeout(() => { dragged = false; }, 0);
  }
  lightbox.addEventListener("pointerup", endPan);
  lightbox.addEventListener("pointercancel", endPan);

  function sync() {
    document.body.classList.toggle("viewer-dark", desktop.matches && !document.body.classList.contains("at-home") && background === "dark");
    nav.querySelectorAll("a").forEach((link) => {
      if (link.getAttribute("href") === location.hash) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    backgrounds.querySelectorAll("button").forEach((choice) => choice.setAttribute("aria-pressed", String(choice.dataset.background === background)));
    groups = [...gallery.children].filter((node) => node.classList.contains("edition-spread"));
    if (desktop.matches && !stage) {
      stage = document.createElement("div");
      stage.className = "desktop-lightbox-viewport";
      stage.addEventListener("click", (event) => {
        if (event.target === stage && !stage.classList.contains("is-zoomed")) lightbox.close();
      });
      image.before(stage);
      stage.append(image);
    } else if (!desktop.matches && stage) {
      fit();
      stage.before(image);
      stage.remove();
      stage = null;
    }
    updateGroup();
  }
  new MutationObserver(sync).observe(gallery, { childList: true });
  addEventListener("hashchange", sync);
  addEventListener("scroll", () => {
    if (desktop.matches && !frame) frame = requestAnimationFrame(updateGroup);
  }, { passive: true });
  desktop.addEventListener("change", sync);
  addEventListener("resize", () => {
    if (lightbox.open && stage && !stage.classList.contains("is-zoomed")) fit();
  });
  sync();
})();
