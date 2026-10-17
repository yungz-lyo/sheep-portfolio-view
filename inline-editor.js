(() => {
  if (new URLSearchParams(location.search).get("edit") !== "1") return;
  const data = window.SheepPortfolio;
  const key = "sheep-original-layout-draft-v1";
  const original = {
    visible: data.visible, cover: data.cover,
    desktop: data.desktopGroups, mobile: data.mobileGroups, layoutFor: data.layoutFor,
  };
  const history = [];
  let draft;
  try { draft = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* Start a new draft. */ }
  draft ||= { version: 1, removed: [], desktop: {}, mobile: {} };
  const mode = () => "desktop";
  const project = () => data.projectById.get(location.hash.match(/^#project\/([\w-]+)$/)?.[1]);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  data.visible = (item) => original.visible(item).filter((photo) => !draft.removed.includes(photo.id));
  data.cover = (item) => {
    const cover = original.cover(item);
    return cover && !draft.removed.includes(cover.id) ? cover : data.visible(item)[0];
  };
  function rows(item, viewport = mode()) {
    return draft[viewport][item.id] || original[viewport](item).map((photos) => ({ ids: photos.map((photo) => photo.id), layout: original.layoutFor?.(item, photos, viewport) || null }));
  }
  function photos(item, viewport) {
    const available = new Set(data.visible(item).map((photo) => photo.id));
    return rows(item, viewport).map((row) => row.ids.filter((id) => available.has(id)).map((id) => data.photoById.get(id))).filter((row) => row.length);
  }
  data.desktopGroups = (item) => photos(item, "desktop");
  data.mobileGroups = (item) => photos(item, "desktop");
  data.layoutFor = (item, group) => rows(item).find((row) => row.ids.includes(group[0]?.id))?.layout;

  document.body.classList.add("inline-studio");
  const dock = document.createElement("div");
  dock.className = "editor-dock";
  dock.setAttribute("aria-label", "原网页编辑工具");
  const heading = document.createElement("strong");
  heading.textContent = "原网页编辑";
  const status = document.createElement("output");
  status.setAttribute("aria-live", "polite");
  status.textContent = "草稿保存在此浏览器";
  dock.append(heading, status);
  document.body.append(dock);

  function button(parent, label, title, action, disabled = false) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.title = title;
    node.setAttribute("aria-label", title);
    node.disabled = disabled;
    node.addEventListener("click", (event) => { event.stopPropagation(); action(); });
    parent.append(node);
    return node;
  }
  const undo = button(dock, "↶", "撤销上一步", () => {
    draft = history.pop();
    refresh("已撤销上一步");
  }, true);
  button(dock, "查看最终效果", "隐藏编辑工具，查看实际网页", () => {
    const preview = document.body.classList.toggle("is-preview");
    previewButton.textContent = preview ? "返回编辑" : "查看最终效果";
    status.textContent = preview ? "当前草稿的实际呈现" : "草稿保存在此浏览器";
    document.querySelectorAll(".spread-rail, .mobile-swipe-track").forEach((rail) => rail.dispatchEvent(new Event("scroll")));
  });
  const previewButton = dock.lastElementChild;
  button(dock, "导出修改", "导出当前排版，确认后发布", () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }));
    link.download = "sheep-original-layout.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    status.textContent = "已导出修改方案";
  });

  function refresh(message) {
    try { localStorage.setItem(key, JSON.stringify(draft)); status.textContent = message; }
    catch { status.textContent = "浏览器保存失败，请导出修改"; }
    undo.disabled = !history.length;
    const top = scrollY;
    dispatchEvent(new Event("sheep:updated"));
    requestAnimationFrame(() => scrollTo({ top, behavior: "instant" }));
  }
  function change(action, message) {
    history.push(clone(draft));
    const item = project();
    draft[mode()][item.id] ||= clone(rows(item));
    action(draft[mode()][item.id]);
    refresh(message);
  }
  function decorate() {
    const item = project();
    if (!item) return;
    const groups = rows(item);
    document.querySelectorAll("#edition-gallery > .edition-spread").forEach((spread) => {
      if (spread.querySelector(".editor-group-tools")) return;
      const shots = [...spread.querySelectorAll(".edition-shot")];
      const rowIndex = groups.findIndex((row) => row.ids.includes(shots[0]?.dataset.photoId));
      if (rowIndex < 0) return;
      const row = groups[rowIndex];
      const tools = document.createElement("div");
      tools.className = "editor-group-tools";
      const label = document.createElement("span");
      label.textContent = `第 ${rowIndex + 1} 组 · ${shots.length} 张`;
      tools.append(label);
      for (const [layout, text] of [["carousel", "左右轮播"], ["grid", "并排展示"]]) {
        const control = button(tools, text, text, () => change((current) => {
          current[rowIndex].layout = layout;
        }, "已保存本组排版"));
        control.setAttribute("aria-pressed", String((row.layout || (spread.classList.contains("is-carousel") ? "carousel" : "grid")) === layout));
      }
      for (const [offset, text] of [[-1, "↑"], [1, "↓"]]) {
        button(tools, text, offset < 0 ? "整组上移" : "整组下移", () => change((current) => {
          const [moved] = current.splice(rowIndex, 1);
          current.splice(rowIndex + offset, 0, moved);
        }, "已保存组顺序"), rowIndex + offset < 0 || rowIndex + offset >= groups.length);
      }
      spread.prepend(tools);
      spread.style.setProperty("--editor-columns", Math.min(3, shots.length));
      shots.forEach((shot) => {
        const id = shot.dataset.photoId;
        const position = row.ids.indexOf(id);
        const toolbar = document.createElement("div");
        toolbar.className = "editor-photo-tools";
        for (const [offset, text] of [[-1, "←"], [1, "→"]]) {
          button(toolbar, text, offset < 0 ? "图片前移" : "图片后移", () => change((current) => {
            const ids = current[rowIndex].ids;
            [ids[position], ids[position + offset]] = [ids[position + offset], ids[position]];
          }, "已保存图片顺序"), position + offset < 0 || position + offset >= row.ids.length);
        }
        const target = document.createElement("select");
        target.setAttribute("aria-label", "移动图片到其他组");
        groups.forEach((group, index) => {
          const option = document.createElement("option");
          option.value = index;
          option.textContent = `第 ${index + 1} 组`;
          option.selected = index === rowIndex;
          option.disabled = index !== rowIndex && group.ids.length >= 5;
          target.append(option);
        });
        target.addEventListener("change", () => change((current) => {
          current[rowIndex].ids.splice(position, 1);
          current[Number(target.value)].ids.push(id);
          draft[mode()][item.id] = current.filter((group) => group.ids.length);
        }, "已移动图片"));
        toolbar.append(target);
        const remove = button(toolbar, "移出", "从当前作品集移出这张照片", () => change(() => {
          draft.removed.push(id);
          for (const viewport of ["desktop", "mobile"]) {
            if (draft[viewport][item.id]) draft[viewport][item.id] = draft[viewport][item.id]
              .map((group) => ({ ...group, ids: group.ids.filter((photoId) => photoId !== id) })).filter((group) => group.ids.length);
          }
        }, "已移出照片，可撤销"));
        remove.className = "editor-remove";
        shot.append(toolbar);
      });
    });
    requestAnimationFrame(() => document.querySelectorAll(".spread-rail, .mobile-swipe-track").forEach((rail) => rail.dispatchEvent(new Event("scroll"))));
  }
  const gallery = document.querySelector("#edition-gallery");
  new MutationObserver(decorate).observe(gallery, { childList: true });
  addEventListener("DOMContentLoaded", decorate);
})();
