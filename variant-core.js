(() => {
  const projects = window.PORTFOLIO_PROJECTS || [];
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const archive = (window.PORTFOLIO_ARCHIVE || []).filter((photo) =>
    projectById.has(photo.category) && photo.id !== "select-72");
  const photoById = new Map(archive.map((photo) => [photo.id, photo]));
  const storageKey = "sheep-portfolio-removals-v1";
  const hero = "assets/portfolio/select-14.webp";
  const publicView = typeof document !== "undefined" && document.body.classList.contains("public-view");
  const fixed = {
    social: [
      ["select-74", "select-69", "select-75"],
      ["select-01", "select-09"],
      ["pick-72", "pick-71", "pick-35"],
      ["select-84", "select-63", "select-70"],
      ["select-83", "select-82", "select-57", "select-58"],
      ["select-71", "select-77"],
    ],
    "cat-space": [
      ["pick-53", "pick-57"],
      ["pick-28", "pick-30", "pick-31", "pick-32", "pick-37"],
    ],
    grooming: [
      ["pick-10", "pick-41", "pick-39"],
      ["pick-19", "pick-20", "pick-21", "pick-22"],
      ["pick-42", "pick-51", "pick-27"],
    ],
    devices: [
      ["select-92", "select-90", "select-91"],
      ["select-03", "select-24"],
      ["select-26", "select-28"],
      ["select-21", "select-60", "select-48", "select-47"],
      ["select-52", "select-23"],
    ],
    wallets: [
      ["select-31", "select-25"],
      ["select-05", "select-08", "select-42", "select-12", "select-15"],
    ],
  };
  let removed = new Set();

  function readRemoved() {
    if (publicView) {
      removed = new Set((window.SHEEP_EXCLUDED_IDS || []).filter((id) => photoById.has(id)));
      return;
    }
    try {
      removed = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch {
      removed = new Set();
    }
    removed = new Set([...removed].filter((id) => photoById.has(id)));
  }

  function visible(project) {
    return archive.filter((photo) => photo.category === project.id
      && photo.src !== hero && !removed.has(photo.id));
  }

  function cover(project) {
    const items = visible(project);
    return items.find((photo) => photo.src === project.cover)
      || project.photos.map((image) => items.find((photo) => photo.src === image.src)).find(Boolean)
      || items[0];
  }

  function caption(photo) {
    const project = projectById.get(photo.category);
    const named = project?.photos.find((image) => image.src === photo.src)?.caption;
    if (named) return named;
    if (publicView) {
      const number = visible(project).findIndex((image) => image.id === photo.id) + 1;
      return `${project.title}影像 ${String(number).padStart(2, "0")}`;
    }
    return photo.filename.replace(/\.[^.]+$/, "");
  }

  function distance(a, b) {
    return Math.abs(a.warmth - b.warmth) * .8
      + Math.abs(a.lightness - b.lightness) * .35
      + Math.abs(a.saturation - b.saturation) * .2
      + Math.abs(Math.log((a.width / a.height) / (b.width / b.height))) * 22;
  }

  function groups(project) {
    const items = visible(project);
    const lead = cover(project);
    if (!lead) return [];
    const available = new Map(items.filter((photo) => photo.id !== lead.id).map((photo) => [photo.id, photo]));
    const arranged = (fixed[project.id] || []).map((ids) => {
      const group = ids.map((id) => available.get(id)).filter(Boolean);
      group.forEach((photo) => available.delete(photo.id));
      return group;
    }).filter((group) => group.length);
    let rest = [...available.values()].sort((a, b) => a.warmth - b.warmth || a.lightness - b.lightness);
    while (rest.length) {
      const first = rest.shift();
      const ratio = first.width / first.height;
      const size = ratio < .85 ? 3 : ratio > 2 ? 2 : 2;
      const group = [first];
      while (group.length < size && rest.length) {
        const match = rest.reduce((best, photo, index) =>
          distance(first, photo) < distance(first, rest[best]) ? index : best, 0);
        group.push(rest.splice(match, 1)[0]);
      }
      arranged.push(group);
    }
    arranged.sort((a, b) => a[0].warmth - b[0].warmth || a[0].lightness - b[0].lightness);
    if (project.id === "feeding") {
      const group = arranged.find((row) => row.some((photo) => photo.id === "pick-48"));
      if (group) group.sort((a, b) => Number(b.id === "pick-48") - Number(a.id === "pick-48"));
    }
    return [[lead], ...arranged];
  }

  function mobileGroups(project) {
    const [lead, ...rows] = groups(project);
    if (!lead) return [];
    const photos = rows.flat();
    const boundaries = new Set();
    let offset = 0;
    rows.forEach((row) => {
      offset += row.length;
      boundaries.add(offset);
    });
    const best = Array(photos.length + 1);
    best[photos.length] = { cost: 0, runs: [] };
    const sizeCost = [0, 8, 3, 0, .8, 1.7];
    for (let start = photos.length - 1; start >= 0; start -= 1) {
      for (let size = 1; size <= 5 && start + size <= photos.length; size += 1) {
        const end = start + size;
        const cost = sizeCost[size] + (end < photos.length && !boundaries.has(end) ? 2 : 0) + best[end].cost;
        if (!best[start] || cost < best[start].cost) {
          best[start] = { cost, runs: [photos.slice(start, end), ...best[end].runs] };
        }
      }
    }
    return [lead, ...best[0].runs];
  }

  function remove(id) {
    if (publicView || !photoById.has(id)) return;
    removed.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...removed])); } catch { /* Local browsing still works. */ }
    dispatchEvent(new Event("sheep:updated"));
  }

  function dragRail(rail) {
    let drag = null;
    let suppressClick = false;
    rail.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || !rail.scrollWidth || rail.scrollWidth <= rail.clientWidth) return;
      drag = { x: event.clientX, left: rail.scrollLeft, id: event.pointerId, moved: false };
    });
    rail.addEventListener("pointermove", (event) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(event.clientX - drag.x) > 6) {
        drag.moved = true;
        rail.setPointerCapture(drag.id);
        rail.classList.add("is-dragging");
      }
      if (drag.moved) rail.scrollLeft = drag.left + drag.x - event.clientX;
    });
    function stop() {
      if (!drag) return;
      suppressClick = drag.moved;
      drag = null;
      rail.classList.remove("is-dragging");
      setTimeout(() => { suppressClick = false; }, 0);
    }
    rail.addEventListener("pointerup", stop);
    rail.addEventListener("pointercancel", stop);
    rail.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);
  }

  readRemoved();
  addEventListener("storage", (event) => {
    if (publicView) return;
    if (event.key !== storageKey) return;
    readRemoved();
    dispatchEvent(new Event("sheep:updated"));
  });

  window.SheepPortfolio = { projects, archive, projectById, photoById, hero,
    visible, cover, caption, groups, mobileGroups, remove, dragRail, get removed() { return removed; } };
})();
