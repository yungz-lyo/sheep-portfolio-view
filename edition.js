(() => {
  const data = window.SheepPortfolio;
  const home = document.querySelector("#home-view");
  const detail = document.querySelector("#detail-view");
  const index = document.querySelector("#edition-index");
  const gallery = document.querySelector("#edition-gallery");
  const lightbox = document.querySelector("#edition-lightbox");
  const lightboxImage = lightbox.querySelector("img");
  const editButton = document.querySelector("#edition-edit");
  const publicView = document.body.classList.contains("public-view");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const observer = "IntersectionObserver" in window && !reduced.matches
    ? new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }), { threshold: .08 }) : null;
  let project = null;
  let sequence = [];
  let photoIndex = 0;
  let lastTrigger = null;

  function element(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text != null) item.textContent = text;
    return item;
  }

  function reveal(root) {
    if (!observer) return;
    root.querySelectorAll(".enter").forEach((item) => observer.observe(item));
    document.documentElement.classList.add("motion-ready");
  }

  function imageFor(photo, priority = false) {
    const image = element("img");
    image.src = photo.src;
    image.alt = data.caption(photo);
    image.width = photo.width;
    image.height = photo.height;
    image.loading = priority ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;
    return image;
  }

  function renderIndex() {
    const fragment = document.createDocumentFragment();
    data.projects.forEach((item) => {
      const pictures = data.visible(item);
      const cover = data.cover(item);
      if (!cover) return;
      const side = pictures.find((photo) => photo.id !== cover.id && photo.width / photo.height < .9)
        || pictures.find((photo) => photo.id !== cover.id);
      const link = element("a", "project-link enter");
      link.href = `#project/${item.id}`;
      link.setAttribute("aria-label", `查看${item.title}，${pictures.length}张影像`);
      const copy = element("div", "project-copy");
      copy.append(
        element("span", "project-number", `${item.number} / 06`),
        element("h3", "project-title", item.title),
        element("p", "project-desc", item.intro),
        element("span", "project-more", `${pictures.length} 张影像  →`),
      );
      const main = element("div", "project-media project-main");
      main.append(imageFor(cover));
      link.append(copy, main);
      if (side) {
        const secondary = element("div", "project-media project-side");
        secondary.append(imageFor(side));
        link.append(secondary);
      }
      fragment.append(link);
    });
    index.replaceChildren(fragment);
    reveal(index);
  }

  function photoFigure(photo) {
    const figure = element("figure", "edition-shot");
    figure.dataset.photoId = photo.id;
    const open = element("button", "shot-open");
    open.type = "button";
    open.setAttribute("aria-label", `查看大图：${data.caption(photo)}`);
    open.append(imageFor(photo));
    const caption = element("figcaption");
    caption.append(element("span", null, data.caption(photo)));
    if (!publicView) {
      const remove = element("button", "shot-remove", "移出");
      remove.type = "button";
      remove.title = "从网页移出，不删除原始照片";
      remove.setAttribute("aria-label", `从网页移出：${photo.filename}`);
      caption.append(remove);
    }
    figure.append(open, caption);
    return figure;
  }

  function carousel(photos) {
    const block = element("div", "edition-spread is-carousel enter");
    const bar = element("div", "spread-controls");
    const count = element("span", null, `01 / ${String(photos.length).padStart(2, "0")}`);
    const buttons = element("div");
    const previous = element("button", null, "←");
    const next = element("button", null, "→");
    previous.type = next.type = "button";
    previous.setAttribute("aria-label", "上一张");
    next.setAttribute("aria-label", "下一张");
    buttons.append(previous, next);
    bar.append(count, buttons);
    const rail = element("div", "spread-rail");
    rail.tabIndex = 0;
    rail.setAttribute("role", "region");
    rail.setAttribute("aria-label", "图片轮播");
    data.dragRail(rail);
    photos.forEach((photo) => rail.append(photoFigure(photo)));
    function active() {
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2) return photos.length - 1;
      const left = rail.getBoundingClientRect().left;
      return [...rail.children].reduce((best, child, position, children) =>
        Math.abs(child.getBoundingClientRect().left - left) < Math.abs(children[best].getBoundingClientRect().left - left) ? position : best, 0);
    }
    function update() {
      const position = active();
      count.textContent = `${String(position + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
      previous.disabled = position === 0;
      next.disabled = position === photos.length - 1;
    }
    function move(direction) {
      const target = rail.children[Math.max(0, Math.min(photos.length - 1, active() + direction))];
      if (target) rail.scrollTo({ left: target.offsetLeft - rail.offsetLeft,
        behavior: reduced.matches ? "auto" : "smooth" });
    }
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    rail.addEventListener("scroll", update, { passive: true });
    rail.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    });
    block.append(bar, rail);
    requestAnimationFrame(update);
    return block;
  }

  function renderDetail(item) {
    project = item;
    document.querySelector("#detail-number").textContent = `${item.number} / 06`;
    document.querySelector("#detail-title").textContent = item.title;
    document.querySelector("#detail-description").textContent = item.intro;
    document.querySelector("#detail-count").textContent = `${data.visible(item).length} 张影像 / ${item.en}`;
    const next = data.projects[(data.projects.indexOf(item) + 1) % data.projects.length];
    const nextLink = document.querySelector("#detail-next");
    nextLink.href = `#project/${next.id}`;
    nextLink.textContent = `${next.title}  →`;
    const fragment = document.createDocumentFragment();
    data.groups(item).forEach((photos, position) => {
      if (photos.length > 4) {
        fragment.append(carousel(photos));
        return;
      }
      const block = element("div", `edition-spread enter ${photos.length === 1 ? "is-single" : ""} ${position === 0 ? "is-cover" : ""}`);
      if (photos.length === 1 && photos[0].width / photos[0].height < .85) block.classList.add("is-portrait");
      if (photos.length === 2 && photos.every((photo) => photo.width / photo.height < .9)) block.classList.add("mobile-pair");
      else if (photos.length > 1) {
        block.classList.add("mobile-swipe");
        block.tabIndex = 0;
        block.setAttribute("role", "region");
        block.setAttribute("aria-label", `${item.title}图片组`);
        const controls = element("div", "mobile-swipe-controls");
        const count = element("span");
        const previous = element("button", null, "←");
        const next = element("button", null, "→");
        previous.type = next.type = "button";
        previous.setAttribute("aria-label", "上一张");
        next.setAttribute("aria-label", "下一张");
        controls.append(count, previous, next);
        function active() {
          const shots = [...block.querySelectorAll(".edition-shot")];
          const left = block.getBoundingClientRect().left;
          return shots.reduce((best, shot, position) =>
            Math.abs(shot.getBoundingClientRect().left - left) < Math.abs(shots[best].getBoundingClientRect().left - left) ? position : best, 0);
        }
        function update() {
          const position = active();
          count.textContent = `${String(position + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
          previous.disabled = position === 0;
          next.disabled = position === photos.length - 1;
        }
        function move(direction) {
          const shot = block.querySelectorAll(".edition-shot")[Math.max(0, Math.min(photos.length - 1, active() + direction))];
          if (shot) block.scrollTo({ left: shot.offsetLeft - block.offsetLeft, behavior: reduced.matches ? "auto" : "smooth" });
        }
        previous.addEventListener("click", () => move(-1));
        next.addEventListener("click", () => move(1));
        block.addEventListener("scroll", update, { passive: true });
        block.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        });
        block.append(controls);
        requestAnimationFrame(update);
      }
      if (photos.length > 1) block.style.gridTemplateColumns = photos.map((photo) => `${photo.width / photo.height}fr`).join(" ");
      photos.forEach((photo) => block.append(photoFigure(photo)));
      fragment.append(block);
    });
    if (!fragment.childNodes.length) fragment.append(element("p", "empty-project", "这一组暂时没有保留的图片。"));
    gallery.replaceChildren(fragment);
    reveal(gallery);
  }

  function route() {
    const match = location.hash.match(/^#project\/([\w-]+)$/);
    const item = match && data.projectById.get(match[1]);
    const changing = Boolean(item) !== !detail.hidden || item?.id !== project?.id;
    home.hidden = Boolean(item);
    detail.hidden = !item;
    document.body.classList.toggle("at-home", !item);
    if (item) renderDetail(item);
    else project = null;
    if (changing) {
      if (!item && location.hash === "#projects") requestAnimationFrame(() => document.querySelector("#projects").scrollIntoView());
      else if (!item && location.hash === "#about") requestAnimationFrame(() => document.querySelector("#about").scrollIntoView());
      else scrollTo({ top: 0, behavior: "auto" });
    }
    updateScroll();
  }

  function showImage(index) {
    if (!sequence.length) return;
    photoIndex = (index + sequence.length) % sequence.length;
    const photo = sequence[photoIndex];
    lightboxImage.src = photo.src;
    lightboxImage.alt = data.caption(photo);
    lightbox.querySelector(".lightbox-caption").textContent = data.caption(photo);
    lightbox.querySelector(".lightbox-count").textContent = `${String(photoIndex + 1).padStart(2, "0")} / ${String(sequence.length).padStart(2, "0")}`;
    lightbox.querySelector(".lightbox-prev").disabled = sequence.length < 2;
    lightbox.querySelector(".lightbox-next").disabled = sequence.length < 2;
  }

  gallery.addEventListener("click", (event) => {
    const remove = event.target.closest(".shot-remove");
    if (remove) {
      data.remove(remove.closest(".edition-shot").dataset.photoId);
      return;
    }
    const open = event.target.closest(".shot-open");
    if (!open) return;
    lastTrigger = open;
    sequence = [...gallery.querySelectorAll(".edition-shot")].map((shot) => data.photoById.get(shot.dataset.photoId));
    showImage(sequence.findIndex((photo) => photo.id === open.closest(".edition-shot").dataset.photoId));
    lightbox.showModal();
  });
  lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.querySelector(".lightbox-prev").addEventListener("click", () => showImage(photoIndex - 1));
  lightbox.querySelector(".lightbox-next").addEventListener("click", () => showImage(photoIndex + 1));
  if (!publicView) lightbox.querySelector(".lightbox-remove").addEventListener("click", () => {
    data.remove(sequence[photoIndex].id);
    lightbox.close();
  });
  lightbox.addEventListener("click", (event) => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") showImage(photoIndex - 1);
    if (event.key === "ArrowRight") showImage(photoIndex + 1);
  });
  lightbox.addEventListener("close", () => { lightboxImage.removeAttribute("src"); lastTrigger?.focus(); });
  let touchStart = 0;
  lightbox.addEventListener("touchstart", (event) => { touchStart = event.changedTouches[0].screenX; }, { passive: true });
  lightbox.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].screenX - touchStart;
    if (Math.abs(distance) > 60) showImage(photoIndex + (distance < 0 ? 1 : -1));
  }, { passive: true });

  if (!publicView) editButton.addEventListener("click", () => {
    const active = document.body.classList.toggle("is-editing");
    editButton.textContent = active ? "完成" : "整理";
    editButton.setAttribute("aria-pressed", String(active));
  });
  addEventListener("sheep:updated", () => {
    renderIndex();
    if (project) renderDetail(project);
  });
  addEventListener("hashchange", route);

  const scrollLine = document.querySelector(".scroll-line");
  const heroImage = document.querySelector(".edition-hero > img");
  let pending = false;
  function updateScroll() {
    document.body.classList.toggle("scrolled", scrollY > 48 || !detail.hidden);
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollLine.style.width = `${max > 0 ? Math.min(100, scrollY / max * 100) : 0}%`;
    if (!reduced.matches && innerWidth > 650 && detail.hidden && scrollY < innerHeight) {
      heroImage.style.transform = `scale(1.04) translateY(${Math.min(scrollY * .08, 50)}px)`;
    }
    pending = false;
  }
  addEventListener("scroll", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(updateScroll);
  }, { passive: true });
  addEventListener("resize", updateScroll, { passive: true });

  renderIndex();
  route();
})();
