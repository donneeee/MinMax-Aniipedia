const DATA_URL = "./data/map_site_data.json?v=20260712-special-boss-aniimo";
const APP_VERSION = "v0.1.0";
const MIN_SCALE = 0.03;
const MAX_SCALE = 16;
const MAP_EDGE_MARGIN = 48;
const COLORS = [
  "#7fc6b2",
  "#e8bf63",
  "#e56f5f",
  "#8eb8f4",
  "#b48fe8",
  "#73c66b",
  "#f294b1",
  "#75c7d8",
  "#d0b071",
  "#a6c46f",
  "#dd8c6d",
  "#6fac9f",
];

const state = {
  data: null,
  enabled: new Set(),
  activeLayer: "items",
  search: "",
  scale: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  dragStart: null,
  selectedPin: null,
  selectedSpawnIndex: null,
};

const els = {
  mapMeta: document.querySelector("#mapMeta"),
  appVersion: document.querySelector("#appVersion"),
  searchInput: document.querySelector("#searchInput"),
  filterCount: document.querySelector("#filterCount"),
  layerTabs: document.querySelector("#layerTabs"),
  itemList: document.querySelector("#itemList"),
  selectionDetail: document.querySelector("#selectionDetail"),
  mapPanel: document.querySelector(".map-panel"),
  mapViewport: document.querySelector("#mapViewport"),
  mapWorld: document.querySelector("#mapWorld"),
  mapTiles: document.querySelector("#mapTiles"),
  mapImage: document.querySelector("#mapImage"),
  pinLayer: document.querySelector("#pinLayer"),
  coordinateReadout: document.querySelector("#coordinateReadout"),
  selectAllButton: document.querySelector("#selectAllButton"),
  selectNoneButton: document.querySelector("#selectNoneButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  fitButton: document.querySelector("#fitButton"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

function formatCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "";
}

function colorForIndex(index) {
  return COLORS[index % COLORS.length];
}

function layerColor(layerId, index = 0) {
  if (layerId === "eggs") return "#d66af0";
  if (layerId === "aniimo") return "#6fc7e8";
  if (layerId === "teleports") return "#7bd5ff";
  if (layerId === "ambers") return "#f0b84f";
  if (layerId === "misc") return "#e8bf63";
  return colorForIndex(index);
}

function markerTypeLabel(type) {
  if (type === "elite_egg") return "Elite Egg";
  if (type === "aniimo_spawn") return "Aniimo";
  if (type === "teleport_bloom") return "Bloom";
  if (type === "teleport_sanctum") return "Sanctum";
  if (type === "teleport_branch") return "Branch";
  if (type === "teleport_outpost") return "Outpost";
  if (type === "teleport_nurture") return "Nurture";
  if (type === "teleport_vein_abundance") return "Vein Abundance";
  if (type === "lumin_amber") return "Lumin Amber";
  if (type === "underground_entrance") return "Underground Entrance";
  if (type === "morphling_memory") return "Morphling Memory";
  if (type === "lighthouse_book") return "Book";
  return "Collectable";
}

function stripFormSuffix(value) {
  return String(value || "").replace(/\s+\([^()]+\)\s*$/, "");
}

function aniimoListName(item) {
  if (!item?.is_aniimo) return item?.display_name || "";
  if (item.special_type) return item.display_name || item.species_name || "";
  return item.species_name || stripFormSuffix(item.display_name);
}

function aniilogLabel(item) {
  if (item?.aniilog_number_label) return item.aniilog_number_label;
  const raw = item?.official_no || item?.aniilog_number;
  const number = Number.parseInt(String(raw || "").replace(/\D/g, ""), 10);
  return Number.isFinite(number) ? `#${String(number).padStart(3, "0")}` : "";
}

function aniimoListMeta(item) {
  return [aniilogLabel(item), item.form_label].filter(Boolean).join(" • ");
}

function numericSortValue(value) {
  const number = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function aniimoSpeciesSortName(item) {
  return item.species_name || stripFormSuffix(item.display_name);
}

function aniimoFormSortRank(item) {
  if (item.form_label === "Basic") return 0;
  if (item.special_type) return 2;
  return 1;
}

function compareItems(a, b) {
  if (a.is_aniimo && b.is_aniimo) {
    const numberCompare = numericSortValue(a.aniilog_sort_number ?? a.aniilog_number ?? a.official_no ?? a.aniimo_id)
      - numericSortValue(b.aniilog_sort_number ?? b.aniilog_number ?? b.official_no ?? b.aniimo_id);
    if (numberCompare !== 0) return numberCompare;

    const nameCompare = compareText(aniimoSpeciesSortName(a), aniimoSpeciesSortName(b));
    if (nameCompare !== 0) return nameCompare;

    const formRankCompare = aniimoFormSortRank(a) - aniimoFormSortRank(b);
    if (formRankCompare !== 0) return formRankCompare;

    const formCompare = compareText(a.form_label, b.form_label);
    if (formCompare !== 0) return formCompare;
  }

  const nameCompare = compareText(a.display_name, b.display_name);
  if (nameCompare !== 0) return nameCompare;
  return compareText(a.item_id, b.item_id);
}

function areaDetailValue(spawn) {
  return spawn.area_name || spawn.large_area_name || spawn.level_area_name || spawn.area_inferred_name || spawn.region_name || "";
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function resetDocumentScroll() {
  const scrollingElement = document.scrollingElement || document.documentElement;
  if (window.scrollX || window.scrollY) {
    window.scrollTo(0, 0);
  }
  [scrollingElement, document.documentElement, document.body].forEach((element) => {
    if (!element) return;
    if (element.scrollLeft) element.scrollLeft = 0;
    if (element.scrollTop) element.scrollTop = 0;
  });
}

function stabilizeViewport() {
  resetDocumentScroll();
  resetMapScroll();
}

function preventControlFocus(event) {
  event.preventDefault();
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old clipboard path.
  }
  return fallbackCopyText(text);
}

async function copyDetailValue(element, value) {
  const copied = await copyText(value);
  if (!copied) return;
  window.clearTimeout(element.copyResetTimer);
  element.dataset.value = value;
  element.textContent = "Copied";
  element.classList.add("copied");
  element.copyResetTimer = window.setTimeout(() => {
    element.classList.add("returning");
    window.setTimeout(() => {
      element.textContent = element.dataset.value || value;
      element.classList.remove("copied", "returning");
    }, 130);
  }, 650);
}

function renderMapBase() {
  const tiles = state.data.map.tiles || [];
  els.mapTiles.textContent = "";
  if (!tiles.length) {
    els.mapTiles.hidden = true;
    els.mapImage.hidden = false;
    els.mapImage.src = state.data.map.image;
    return;
  }

  els.mapTiles.hidden = false;
  els.mapImage.hidden = true;
  els.mapImage.removeAttribute("src");
  const fragment = document.createDocumentFragment();
  tiles.forEach((tile) => {
    const image = document.createElement("img");
    image.className = "map-tile";
    image.alt = "";
    image.decoding = "async";
    image.draggable = false;
    image.loading = "lazy";
    image.src = tile.image;
    image.style.left = `${tile.left}px`;
    image.style.top = `${tile.top}px`;
    image.style.width = `${tile.width}px`;
    image.style.height = `${tile.height}px`;
    fragment.append(image);
  });
  els.mapTiles.replaceChildren(fragment);
}

function resetMapScroll() {
  [els.mapPanel, els.mapViewport].forEach((element) => {
    if (!element) return;
    if (element.scrollLeft) element.scrollLeft = 0;
    if (element.scrollTop) element.scrollTop = 0;
  });
}

function currentMapView() {
  return {
    scale: state.scale,
    panX: state.panX,
    panY: state.panY,
  };
}

function restoreMapView(view) {
  state.scale = view.scale;
  state.panX = view.panX;
  state.panY = view.panY;
  stabilizeViewport();
  applyTransform();
}

function setPinScreenPosition(pin, spawn) {
  if (!state.data || !spawn?.normalized) return;
  pin.style.setProperty("--pin-x", String(spawn.normalized.x * state.data.map.width * state.scale + state.panX));
  pin.style.setProperty("--pin-y", String(spawn.normalized.y * state.data.map.height * state.scale + state.panY));
}

function positionPins() {
  if (!state.data) return;
  for (const pin of els.pinLayer.querySelectorAll(".pin")) {
    const index = Number.parseInt(pin.dataset.spawnIndex || "", 10);
    const spawn = state.data.spawns[index];
    if (spawn) setPinScreenPosition(pin, spawn);
  }
}

function applyTransform() {
  stabilizeViewport();
  els.mapWorld.style.transform = `matrix(${state.scale}, 0, 0, ${state.scale}, ${state.panX}, ${state.panY})`;
  positionPins();
}

function mapFitScale(rect = els.mapViewport.getBoundingClientRect()) {
  const width = state.data.map.width;
  const height = state.data.map.height;
  const padding = rect.width < 700 ? 24 : 56;
  return Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height);
}

function clampPan() {
  if (!state.data) return;
  const rect = els.mapViewport.getBoundingClientRect();
  const scaledWidth = state.data.map.width * state.scale;
  const scaledHeight = state.data.map.height * state.scale;

  if (scaledWidth <= rect.width) {
    state.panX = (rect.width - scaledWidth) / 2;
  } else {
    state.panX = clamp(state.panX, rect.width - scaledWidth - MAP_EDGE_MARGIN, MAP_EDGE_MARGIN);
  }

  if (scaledHeight <= rect.height) {
    state.panY = (rect.height - scaledHeight) / 2;
  } else {
    state.panY = clamp(state.panY, rect.height - scaledHeight - MAP_EDGE_MARGIN, MAP_EDGE_MARGIN);
  }
}

function fitMap() {
  if (!state.data) return;
  const rect = els.mapViewport.getBoundingClientRect();
  const width = state.data.map.width;
  const height = state.data.map.height;
  state.scale = clamp(mapFitScale(rect), MIN_SCALE, MAX_SCALE);
  state.panX = (rect.width - width * state.scale) / 2;
  state.panY = (rect.height - height * state.scale) / 2;
  applyTransform();
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = els.mapViewport.getBoundingClientRect();
  const oldScale = state.scale;
  const mapX = (clientX - rect.left - state.panX) / oldScale;
  const mapY = (clientY - rect.top - state.panY) / oldScale;
  state.scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  state.panX = clientX - rect.left - mapX * state.scale;
  state.panY = clientY - rect.top - mapY * state.scale;
  clampPan();
  applyTransform();
}

function screenToImagePoint(clientX, clientY) {
  const rect = els.mapViewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.panX) / state.scale,
    y: (clientY - rect.top - state.panY) / state.scale,
  };
}

function imagePointToMap(point) {
  const transform = state.data.map.transform;
  const pointA = transform.point_a_position;
  const pointB = transform.point_b_position;
  return {
    x: pointA.x + (point.x / state.data.map.width) * (pointB.x - pointA.x),
    y: pointA.y + (point.y / state.data.map.height) * (pointB.y - pointA.y),
  };
}

function updateCoordinateReadout(event) {
  if (!state.data) return;
  const point = screenToImagePoint(event.clientX, event.clientY);
  const map = imagePointToMap(point);
  els.coordinateReadout.textContent = `X ${formatCoordinate(map.x)}, Y ${formatCoordinate(map.y)}`;
}

function normalizedSearch(value) {
  return value.trim().toLowerCase();
}

function searchText(parts) {
  const values = [];
  parts.forEach((part) => {
    if (Array.isArray(part)) {
      part.forEach((value) => {
        if (value !== null && value !== undefined) values.push(value);
      });
    } else if (part !== null && part !== undefined) {
      values.push(part);
    }
  });
  return values.join(" ").toLowerCase();
}

function makeIcon(className, source) {
  const icon = document.createElement("img");
  icon.className = className;
  icon.alt = "";
  icon.draggable = false;
  if (source) {
    icon.src = source;
    icon.addEventListener("error", () => {
      icon.removeAttribute("src");
      icon.classList.add("icon-missing");
    }, { once: true });
  } else {
    icon.classList.add("icon-missing");
  }
  return icon;
}

function itemPassesFilters(item) {
  if (!item) return false;
  return true;
}

function itemMatches(item) {
  if (!itemPassesFilters(item)) return false;
  if (!state.search) return true;
  return item.search_text.includes(state.search);
}

function itemSearchText(item) {
  return searchText([
    item.item_id,
    item.display_id,
    item.aniimo_id,
    item.species_name,
    item.aniilog_number,
    item.aniilog_number_label,
    item.official_no,
    aniimoListName(item),
    item.form_key,
    item.form_name,
    item.form_label,
    item.display_name,
    item.subtitle,
    item.book_names,
    item.layer_id,
    item.inventory_label,
    item.display_type_label,
    item.teleport_type,
    item.region_name,
    item.area_names,
    item.area_uids,
    item.source_item_ids,
    item.egg_item_ids,
    item.area_uid,
    item.area_name,
    item.description,
    item.coordinate_status,
    item.bonus_id,
    item.scene_object_id,
    item.pet_prototype_id,
    item.pet_prototype_ids,
    item.id_in_types,
  ]);
}

function spawnSearchText(spawn) {
  return searchText([
    spawn.item_id,
    spawn.source_item_id,
    spawn.aniimo_id,
    spawn.species_name,
    spawn.form_key,
    spawn.form_name,
    spawn.form_label,
    spawn.display_name,
    spawn.marker_type,
    spawn.layer_id,
    spawn.teleport_type,
    spawn.region_name,
    spawn.area_uid,
    spawn.area_name,
    spawn.large_area_id,
    spawn.large_area_name,
    spawn.level_area_config_id,
    spawn.level_area_name,
    spawn.area_inferred_name,
    spawn.coordinate_key,
    spawn.id_in_type,
    spawn.pet_prototype_id,
    spawn.x,
    spawn.y,
  ]);
}

function spawnMatches(spawn) {
  if (!state.enabled.has(spawn.item_id)) return false;
  const item = state.data.itemsById.get(spawn.item_id);
  if (!itemPassesFilters(item)) return false;
  if (!state.search) return true;
  return item.search_text.includes(state.search) || spawn.search_text.includes(state.search);
}

function visibleSpawnEntries() {
  const entries = [];
  for (const itemId of state.enabled) {
    const item = state.data.itemsById.get(itemId);
    if (!itemPassesFilters(item)) continue;
    const itemSpawns = state.data.spawnsByItemId.get(itemId) || [];
    const itemMatchesSearch = !state.search || item.search_text.includes(state.search);
    itemSpawns.forEach((entry) => {
      if (!state.search || itemMatchesSearch || entry.spawn.search_text.includes(state.search)) {
        entries.push(entry);
      }
    });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries;
}

function updateFilterCount() {
  if (!els.filterCount || !state.data) return;
  const activeItems = state.data.items.filter((item) => item.layer_id === state.activeLayer);
  const selectedCount = activeItems.filter((item) => state.enabled.has(item.item_id)).length;
  els.filterCount.textContent = `${selectedCount} / ${activeItems.length}`;
}

function refreshVisibility() {
  const visibleEntries = visibleSpawnEntries();
  renderPins(visibleEntries);

  for (const row of els.itemList.querySelectorAll(".item-row")) {
    const item = state.data.itemsById.get(row.dataset.itemId);
    row.classList.toggle("enabled", state.enabled.has(item.item_id));
    row.hidden = !itemMatches(item);
    row.setAttribute("aria-pressed", String(state.enabled.has(item.item_id)));
  }

  for (const section of els.itemList.querySelectorAll(".layer-panel")) {
    const rows = [...section.querySelectorAll(".item-row")];
    const visibleRows = rows.filter((row) => !row.hidden).length;
    const tab = els.layerTabs.querySelector(`[data-layer-id="${section.dataset.layerId}"]`);
    section.hidden = section.dataset.layerId !== state.activeLayer;
    if (tab) {
      tab.hidden = Boolean(state.search) && visibleRows === 0;
      tab.setAttribute("aria-selected", String(section.dataset.layerId === state.activeLayer));
      tab.tabIndex = section.dataset.layerId === state.activeLayer ? 0 : -1;
    }
  }

  const activeTab = els.layerTabs.querySelector(`.layer-tab[data-layer-id="${state.activeLayer}"]`);
  if (activeTab?.hidden) {
    const nextTab = [...els.layerTabs.querySelectorAll(".layer-tab")].find((tab) => !tab.hidden);
    if (nextTab) {
      state.activeLayer = nextTab.dataset.layerId;
      refreshVisibility();
      return;
    }
  }

  updateFilterCount();
  stabilizeViewport();
}

function renderItems() {
  els.layerTabs.textContent = "";
  els.itemList.textContent = "";
  const layers = state.data.layers?.length
    ? state.data.layers
    : [{ id: "items", label: "Items" }, { id: "aniimo", label: "Aniimo" }, { id: "eggs", label: "Eggs" }];
  const layersWithItems = layers.filter((layer) => state.data.items.some((item) => item.layer_id === layer.id));
  if (!layersWithItems.some((layer) => layer.id === state.activeLayer)) {
    state.activeLayer = layersWithItems[0]?.id || "";
  }

  layersWithItems.forEach((layer) => {
    const layerItems = state.data.items.filter((item) => item.layer_id === layer.id);

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "layer-tab";
    tab.dataset.layerId = layer.id;
    tab.id = `layer-tab-${layer.id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `layer-panel-${layer.id}`);
    tab.setAttribute("aria-selected", String(layer.id === state.activeLayer));
    tab.tabIndex = layer.id === state.activeLayer ? 0 : -1;
    tab.addEventListener("click", () => {
      state.activeLayer = layer.id;
      refreshVisibility();
    });
    tab.addEventListener("dblclick", (event) => {
      event.preventDefault();
      state.activeLayer = layer.id;
      const selectableItems = layerItems.filter((item) => itemPassesFilters(item));
      const allSelected = selectableItems.length > 0
        && selectableItems.every((item) => state.enabled.has(item.item_id));
      selectableItems.forEach((item) => {
        if (allSelected) {
          state.enabled.delete(item.item_id);
        } else {
          state.enabled.add(item.item_id);
        }
      });
      refreshVisibility();
    });
    const tabLabel = document.createElement("span");
    tabLabel.textContent = layer.label;
    tab.append(tabLabel);
    els.layerTabs.append(tab);

    const section = document.createElement("section");
    section.className = "layer-panel";
    section.dataset.layerId = layer.id;
    section.id = `layer-panel-${layer.id}`;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", tab.id);
    section.hidden = layer.id !== state.activeLayer;

    layerItems.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = [
      "item-row",
      state.enabled.has(item.item_id) ? "enabled" : "",
      item.is_elite_egg ? "elite-egg" : "",
      item.is_aniimo ? "aniimo-row" : "",
      item.is_elite_egg && !item.spawn_count ? "unplaced" : "",
    ].filter(Boolean).join(" ");
    row.dataset.itemId = item.item_id;
    row.setAttribute("aria-pressed", String(state.enabled.has(item.item_id)));
    row.addEventListener("mousedown", preventControlFocus);
    row.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.enabled.has(item.item_id)) {
        state.enabled.delete(item.item_id);
      } else {
        state.enabled.add(item.item_id);
      }
      refreshVisibility();
    });

    const icon = makeIcon("item-icon", item.icon);

    const text = document.createElement("span");
    text.className = "item-text";
    const strong = document.createElement("strong");
    strong.textContent = item.is_aniimo ? aniimoListName(item) : item.display_name;
    const small = document.createElement("small");
    const smallParts = item.subtitle
      ? [item.subtitle]
      : item.is_aniimo
        ? [aniimoListMeta(item)]
        : item.is_elite_egg
          ? [item.region_name || item.area_name || item.display_type_label]
          : [item.display_type_label, item.region_name];
    small.textContent = smallParts.filter(Boolean).join(" - ");
    strong.title = strong.textContent;
    small.title = small.textContent;
    text.append(strong, small);

    const count = document.createElement("span");
    count.className = "item-count";
    count.textContent = item.is_elite_egg && !item.spawn_count ? "No pin" : item.spawn_count;

      row.append(icon, text, count);
      section.append(row);
    });

    els.itemList.append(section);
  });
}

function renderPins(entries) {
  const fragment = document.createDocumentFragment();
  state.selectedPin = null;
  entries.forEach(({ spawn, index }) => {
    const item = state.data.itemsById.get(spawn.item_id);
    if (!item) return;
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = [
      "pin",
      spawn.marker_type === "elite_egg" ? "pin-elite-egg" : "",
      spawn.marker_type === "aniimo_spawn" ? "pin-aniimo-spawn" : "",
      spawn.layer_id === "teleports" ? "pin-teleport" : "",
      spawn.layer_id === "ambers" ? "pin-amber" : "",
      spawn.marker_type === "underground_entrance" ? "pin-underground" : "",
    ]
      .filter(Boolean)
      .join(" ");
    pin.dataset.spawnIndex = String(index);
    pin.style.setProperty("--pin-color", item.color);
    setPinScreenPosition(pin, spawn);
    pin.setAttribute(
      "aria-label",
      `${spawn.display_name} ${spawn.area_name || spawn.region_name || ""} ${formatCoordinate(spawn.x)} ${formatCoordinate(spawn.y)}`,
    );

    const icon = makeIcon("pin-icon", item.icon);

    const label = document.createElement("span");
    label.className = "pin-label";
    const areaLabel = spawn.area_name || spawn.region_name;
    const labelName = areaLabel ? `${spawn.display_name} (${areaLabel})` : spawn.display_name;
    label.textContent = `${labelName} ${Math.round(spawn.x)}, ${Math.round(spawn.y)}`;
    pin.append(icon, label);
    pin.tabIndex = -1;
    pin.addEventListener("mousedown", preventControlFocus);
    pin.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = currentMapView();
      selectSpawn(index);
      restoreMapView(view);
    });
    if (state.selectedSpawnIndex === index) {
      pin.classList.add("selected");
      state.selectedPin = pin;
    }
    fragment.append(pin);
  });
  els.pinLayer.replaceChildren(fragment);
}

function selectSpawn(index) {
  const spawn = state.data.spawns[index];
  if (!spawn) return;
  const item = state.data.itemsById.get(spawn.item_id);
  if (!item) return;
  if (state.selectedPin) {
    state.selectedPin.classList.remove("selected");
  }
  state.selectedSpawnIndex = index;
  const pin = els.pinLayer.querySelector(`[data-spawn-index="${index}"]`);
  if (pin) pin.classList.add("selected");
  state.selectedPin = pin;
  els.selectionDetail.className = "selection";
  els.selectionDetail.innerHTML = "";

  const title = document.createElement("div");
  title.className = "selection-title";
  const icon = makeIcon("", item.icon);
  const titleText = document.createElement("div");
  const strong = document.createElement("strong");
  strong.className = "selection-name copyable-detail";
  strong.textContent = spawn.display_name;
  strong.tabIndex = 0;
  strong.setAttribute("role", "button");
  strong.setAttribute("aria-label", `Copy name ${spawn.display_name}`);
  strong.title = "Copy name";
  strong.addEventListener("click", () => copyDetailValue(strong, spawn.display_name));
  strong.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    copyDetailValue(strong, spawn.display_name);
  });
  const small = document.createElement("small");
  small.textContent = [
    spawn.form_label,
    areaDetailValue(spawn) || item.region_name || markerTypeLabel(spawn.marker_type),
  ].filter(Boolean).join(" - ");
  titleText.append(strong, small);
  title.append(icon, titleText);

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  const typeLabel = spawn.display_type_label || item.display_type_label || markerTypeLabel(spawn.marker_type);
  const rows = [
    ["Type", typeLabel],
    ["X", formatCoordinate(spawn.x), formatCoordinate(spawn.x)],
    ["Y", formatCoordinate(spawn.y), formatCoordinate(spawn.y)],
    ["Height", formatNumber(spawn.height_y, 2)],
  ];
  const areaValue = areaDetailValue(spawn);
  if (areaValue) rows.push(["Area", areaValue]);
  if (spawn.form_label || item.form_label) rows.push(["Form", spawn.form_label || item.form_label]);
  const regionValue = spawn.region_name || item.region_name;
  if (regionValue && regionValue !== areaValue && !areaValue.includes(regionValue)) {
    rows.push(["Region", regionValue]);
  }
  rows.forEach(([label, value, copyValue]) => {
    const left = document.createElement("span");
    left.textContent = label;
    const right = document.createElement("span");
    right.className = "detail-value";
    right.textContent = value || "";
    if (copyValue) {
      right.classList.add("copyable-detail");
      right.tabIndex = 0;
      right.setAttribute("role", "button");
      right.setAttribute("aria-label", `Copy ${label} coordinate ${copyValue}`);
      right.title = `Copy ${label}`;
      right.addEventListener("click", () => copyDetailValue(right, copyValue));
      right.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        copyDetailValue(right, copyValue);
      });
    }
    grid.append(left, right);
  });

  const locate = document.createElement("button");
  locate.type = "button";
  locate.textContent = "Locate";
  locate.addEventListener("click", () => focusSpawn(spawn));
  els.selectionDetail.append(title, grid, locate);
}

function focusSpawn(spawn) {
  const rect = els.mapViewport.getBoundingClientRect();
  const locateScale = clamp(mapFitScale(rect) * 3.5, MIN_SCALE, 0.55);
  state.scale = Math.max(state.scale, locateScale);
  state.panX = rect.width / 2 - spawn.normalized.x * state.data.map.width * state.scale;
  state.panY = rect.height / 2 - spawn.normalized.y * state.data.map.height * state.scale;
  clampPan();
  applyTransform();
}

function prepareData(data) {
  data.itemsById = new Map();
  data.spawnsByItemId = new Map();
  data.items.forEach((item) => {
    item.layer_id = item.layer_id || (item.is_elite_egg ? "eggs" : "items");
  });
  data.items.sort(compareItems);
  data.items.forEach((item, index) => {
    item.layer_id = item.layer_id || (item.is_elite_egg ? "eggs" : "items");
    item.color = layerColor(item.layer_id, index);
    item.search_text = itemSearchText(item);
    data.itemsById.set(item.item_id, item);
  });
  data.spawns.sort((a, b) => {
    const nameCompare = a.display_name.localeCompare(b.display_name);
    if (nameCompare !== 0) return nameCompare;
    return a.coordinate_key.localeCompare(b.coordinate_key);
  });
  data.spawns.forEach((spawn, index) => {
    spawn.search_text = spawnSearchText(spawn);
    if (!data.spawnsByItemId.has(spawn.item_id)) {
      data.spawnsByItemId.set(spawn.item_id, []);
    }
    data.spawnsByItemId.get(spawn.item_id).push({ spawn, index });
  });
  return data;
}

function bindEvents() {
  window.addEventListener("scroll", resetDocumentScroll, { passive: true });
  els.mapViewport.addEventListener("scroll", resetMapScroll, { passive: true });
  els.searchInput.addEventListener("input", () => {
    state.search = normalizedSearch(els.searchInput.value);
    refreshVisibility();
  });
  els.selectAllButton.addEventListener("click", () => {
    state.data.items.forEach((item) => state.enabled.add(item.item_id));
    refreshVisibility();
  });
  els.selectNoneButton.addEventListener("click", () => {
    state.enabled.clear();
    refreshVisibility();
  });
  els.zoomInButton.addEventListener("click", () => {
    const rect = els.mapViewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.scale * 1.25);
  });
  els.zoomOutButton.addEventListener("click", () => {
    const rect = els.mapViewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.scale / 1.25);
  });
  els.fitButton.addEventListener("click", fitMap);
  els.mapViewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.88;
    zoomAt(event.clientX, event.clientY, state.scale * factor);
  }, { passive: false });
  els.mapViewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".pin")) return;
    state.dragging = true;
    state.dragStart = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    els.mapViewport.classList.add("dragging");
    els.mapViewport.setPointerCapture(event.pointerId);
  });
  els.mapViewport.addEventListener("pointermove", (event) => {
    updateCoordinateReadout(event);
    if (!state.dragging) return;
    state.panX = state.dragStart.panX + event.clientX - state.dragStart.x;
    state.panY = state.dragStart.panY + event.clientY - state.dragStart.y;
    clampPan();
    applyTransform();
  });
  els.mapViewport.addEventListener("pointerup", (event) => {
    state.dragging = false;
    els.mapViewport.classList.remove("dragging");
    els.mapViewport.releasePointerCapture(event.pointerId);
  });
  els.mapViewport.addEventListener("pointerleave", () => {
    state.dragging = false;
    els.mapViewport.classList.remove("dragging");
  });
  window.addEventListener("resize", fitMap);
}

async function init() {
  bindEvents();
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}`);
  }
  state.data = prepareData(await response.json());
  renderMapBase();
  els.mapWorld.style.width = `${state.data.map.width}px`;
  els.mapWorld.style.height = `${state.data.map.height}px`;
  els.appVersion.textContent = APP_VERSION;
  els.mapMeta.textContent = [
    `${state.data.counts.spawns} markers`,
    `${state.data.counts.collectable_items || 0} items`,
    `${state.data.counts.aniimo || 0} Aniimo`,
    `${state.data.counts.elite_eggs || 0} eggs`,
    `${state.data.counts.teleports || 0} teleports`,
    `${state.data.counts.ambers || 0} ambers`,
    `${state.data.counts.misc || 0} misc`,
  ].join(" - ");
  renderItems();
  refreshVisibility();
  fitMap();
}

init().catch((error) => {
  els.mapMeta.textContent = "Load failed";
  els.selectionDetail.textContent = error.message;
  console.error(error);
});
