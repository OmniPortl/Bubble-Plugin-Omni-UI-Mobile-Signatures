const ui = {
  element: document.querySelector("#element-select"),
  scenario: document.querySelector("#scenario-select"),
  width: document.querySelector("#viewport-width"),
  height: document.querySelector("#viewport-height"),
  apply: document.querySelector("#apply-update"),
  remount: document.querySelector("#remount"),
  properties: document.querySelector("#properties-editor"),
  datasets: document.querySelector("#datasets-editor"),
  context: document.querySelector("#context-editor"),
  contract: document.querySelector("#field-contract"),
  status: document.querySelector("#status"),
  dimensions: document.querySelector("#dimensions"),
  frame: document.querySelector("#stage-frame"),
  canvas: document.querySelector("#bubble-canvas"),
};

let bootstrap = null;
let activeInstance = null;
let activeFunctions = null;
let activeVersion = "";
let dependenciesLoaded = false;

await reloadBootstrap({ preserveSelection: false });
connectControls();
window.setInterval(checkForChanges, bootstrap.config.poll_interval_ms ?? 750);

async function reloadBootstrap({ preserveSelection }) {
  const previousElement = preserveSelection ? ui.element.value : "";
  const previousScenario = preserveSelection ? ui.scenario.value : "";
  bootstrap = await requestJson("/api/bootstrap");
  activeVersion = bootstrap.version;
  await loadDependencies(bootstrap.config);

  fillSelect(
    ui.element,
    bootstrap.elements.map((element) => ({
      value: element.key,
      label: element.display,
    })),
    previousElement || bootstrap.config.selected_element,
  );
  fillScenarioSelect(previousScenario);
  applyScenarioToEditors();
  await remount();
}

function connectControls() {
  ui.element.addEventListener("change", () => {
    fillScenarioSelect("");
    applyScenarioToEditors();
    remount();
  });
  ui.scenario.addEventListener("change", () => {
    applyScenarioToEditors();
    remount();
  });
  for (const eventName of ["input", "change"]) {
    ui.width.addEventListener(eventName, applyViewport);
    ui.height.addEventListener(eventName, applyViewport);
  }
  ui.apply.addEventListener("click", applyUpdate);
  ui.remount.addEventListener("click", remount);
  window.addEventListener("beforeunload", destroyCurrent);
}

function fillScenarioSelect(preferred) {
  const elementKey = ui.element.value;
  const scenarios = bootstrap.scenarios
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.scenario.element === elementKey)
    .map((entry) => ({
      value: String(entry.index),
      label: entry.scenario.name,
    }));
  fillSelect(ui.scenario, scenarios, preferred);
}

function applyScenarioToEditors() {
  const scenario = currentScenario();
  if (!scenario) return;
  ui.properties.value = pretty(scenario.properties ?? {});
  ui.datasets.value = pretty(scenario.datasets ?? {});
  ui.context.value = pretty(scenario.context ?? { keys: {} });
  ui.width.value = scenario.viewport?.width ?? 960;
  ui.height.value = scenario.viewport?.height ?? 600;
  applyViewport();
  const element = currentElement();
  const fields = element?.params?.fields ?? {};
  ui.contract.textContent = pretty(
    Object.fromEntries(
      Object.values(fields)
        .filter((field) => field?.name)
        .map((field) => [
          field.name,
          {
            caption: field.caption,
            editor: field.editor,
            value: field.value,
            is_list: field.is_list === true,
            optional: field.optional === true,
          },
        ]),
    ),
  );
}

async function remount() {
  try {
    applyViewport();
    destroyCurrent();
    const element = currentElement();
    if (!element) throw new Error("Choose a web element.");
    const inputs = readEditors();
    const runtime = createFixtureRuntime(inputs.datasets);
    const properties = runtime.hydrate(inputs.properties);
    const context = runtime.hydrate(inputs.context);
    const functions = {
      initialize: evaluateBubbleFunction(
        element.lifecycle.initialize,
        `${element.display} initialize`,
      ),
      update: evaluateBubbleFunction(
        element.lifecycle.update,
        `${element.display} update`,
        true,
      ),
      reset: evaluateBubbleFunction(
        element.lifecycle.reset,
        `${element.display} reset`,
        true,
      ),
    };
    ui.canvas.replaceChildren();
    const instance = createBubbleInstance(ui.canvas);
    activeInstance = { instance, properties, context };
    activeFunctions = functions;
    functions.initialize(instance, context);
    functions.update?.(instance, properties, context);
    setStatus(`${element.display} mounted locally`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
    console.error(error);
  }
}

function applyUpdate() {
  try {
    applyViewport();
    if (!activeInstance || !activeFunctions) {
      remount();
      return;
    }
    const inputs = readEditors();
    const runtime = createFixtureRuntime(inputs.datasets);
    const properties = runtime.hydrate(inputs.properties);
    const context = runtime.hydrate(inputs.context);
    activeInstance.properties = properties;
    activeInstance.context = context;
    activeFunctions.update?.(activeInstance.instance, properties, context);
    setStatus("Bubble-style update applied", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
    console.error(error);
  }
}

function destroyCurrent() {
  if (activeFunctions?.reset && activeInstance) {
    try {
      activeFunctions.reset(
        activeInstance.instance,
        activeInstance.properties,
        activeInstance.context,
      );
    } catch (error) {
      console.warn("Local reset failed", error);
    }
  }
  ui.canvas.replaceChildren();
  activeInstance = null;
  activeFunctions = null;
}

function createBubbleInstance(host) {
  const states = Object.create(null);
  const events = [];
  return {
    canvas: createCanvasCollection([host]),
    data: Object.create(null),
    publishState(name, value) {
      states[name] = value;
    },
    triggerEvent(name) {
      events.push({ name, state: { ...states } });
    },
    __localPreview: { states, events },
  };
}

function createCanvasCollection(nodes) {
  const list = Array.from(nodes).filter(Boolean);
  const collection = {
    length: list.length,
    empty() {
      list.forEach((node) => node.replaceChildren());
      return collection;
    },
    append(value) {
      list.forEach((node) => appendValue(node, value));
      return collection;
    },
    attr(name, value) {
      if (value === undefined) return list[0]?.getAttribute(name) ?? undefined;
      list.forEach((node) => node.setAttribute(name, String(value)));
      return collection;
    },
    css(name, value) {
      if (typeof name === "object") {
        list.forEach((node) => Object.assign(node.style, name));
        return collection;
      }
      if (value === undefined) {
        return list[0] ? getComputedStyle(list[0])[name] : undefined;
      }
      list.forEach((node) => {
        node.style[name] = value;
      });
      return collection;
    },
    width(value) {
      if (value === undefined) return list[0]?.getBoundingClientRect().width ?? 0;
      return collection.css("width", numericCss(value));
    },
    height(value) {
      if (value === undefined)
        return list[0]?.getBoundingClientRect().height ?? 0;
      return collection.css("height", numericCss(value));
    },
    find(selector) {
      return createCanvasCollection(
        list.flatMap((node) => Array.from(node.querySelectorAll(selector))),
      );
    },
    on(type, listener, options) {
      list.forEach((node) => node.addEventListener(type, listener, options));
      return collection;
    },
    off(type, listener, options) {
      list.forEach((node) => node.removeEventListener(type, listener, options));
      return collection;
    },
    addClass(...names) {
      list.forEach((node) => node.classList.add(...names));
      return collection;
    },
    removeClass(...names) {
      list.forEach((node) => node.classList.remove(...names));
      return collection;
    },
    show() {
      return collection.css("display", "");
    },
    hide() {
      return collection.css("display", "none");
    },
    html(value) {
      if (value === undefined) return list[0]?.innerHTML ?? "";
      list.forEach((node) => {
        node.innerHTML = String(value);
      });
      return collection;
    },
    text(value) {
      if (value === undefined) return list[0]?.textContent ?? "";
      list.forEach((node) => {
        node.textContent = String(value);
      });
      return collection;
    },
  };
  list.forEach((node, index) => {
    collection[index] = node;
  });
  return collection;
}

function appendValue(node, value) {
  if (value instanceof Node) {
    node.append(value);
    return;
  }
  if (value && value[0] instanceof Node) {
    node.append(...Array.from({ length: value.length }, (_, index) => value[index]));
    return;
  }
  node.insertAdjacentHTML("beforeend", String(value ?? ""));
}

function createFixtureRuntime(rawDatasets) {
  if (!rawDatasets || typeof rawDatasets !== "object" || Array.isArray(rawDatasets)) {
    throw new Error("Local datasets must be a JSON object.");
  }
  const thingCache = new Map();
  const datasets = Object.fromEntries(
    Object.entries(rawDatasets).map(([name, rows]) => [
      name,
      Array.isArray(rows) ? rows : [],
    ]),
  );

  function thing(datasetName, record) {
    const id = String(record?._id ?? record?.id ?? "");
    const cacheKey = `${datasetName}/${id}`;
    if (id && thingCache.has(cacheKey)) return thingCache.get(cacheKey);
    const value = {
      id,
      _id: id,
      get(fieldName) {
        if (fieldName === "_id") return id;
        return hydrate(record?.[fieldName]);
      },
      listProperties() {
        return Array.from(new Set(["_id", ...Object.keys(record ?? {})]));
      },
    };
    if (id) thingCache.set(cacheKey, value);
    return value;
  }

  function list(values) {
    const items = Array.from(values);
    return {
      length() {
        return items.length;
      },
      get(start, count) {
        return items.slice(start, start + count);
      },
    };
  }

  function hydrate(value) {
    if (Array.isArray(value)) return value.map(hydrate);
    if (!value || typeof value !== "object") return value;
    if (Object.hasOwn(value, "$bubble_list")) {
      const reference = value.$bubble_list;
      if (typeof reference === "string") {
        return list(
          (datasets[reference] ?? []).map((record) => thing(reference, record)),
        );
      }
      if (Array.isArray(reference)) return list(reference.map(hydrate));
      throw new Error("$bubble_list must name a dataset or contain an array.");
    }
    if (Object.hasOwn(value, "$bubble_thing")) {
      const reference = String(value.$bubble_thing);
      const slash = reference.indexOf("/");
      const datasetName = slash >= 0 ? reference.slice(0, slash) : "";
      const id = slash >= 0 ? reference.slice(slash + 1) : reference;
      const record = (datasets[datasetName] ?? []).find(
        (entry) => String(entry?._id ?? entry?.id ?? "") === id,
      );
      return record ? thing(datasetName, record) : null;
    }
    if (Object.hasOwn(value, "$date")) return new Date(value.$date);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, hydrate(entry)]),
    );
  }

  return { hydrate };
}

function evaluateBubbleFunction(source, label, optional = false) {
  if (!source) {
    if (optional) return null;
    throw new Error(`${label} is missing.`);
  }
  const value = Function(`"use strict"; return (${source});`)();
  if (typeof value !== "function") throw new Error(`${label} is not a function.`);
  return value;
}

function readEditors() {
  return {
    properties: parseEditor(ui.properties, "properties"),
    datasets: parseEditor(ui.datasets, "datasets"),
    context: parseEditor(ui.context, "context"),
  };
}

function parseEditor(editor, label) {
  try {
    return JSON.parse(editor.value || "{}");
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
}

function applyViewport() {
  const width = Math.max(120, Number(ui.width.value) || 960);
  const height = Math.max(80, Number(ui.height.value) || 600);
  ui.frame.style.width = `${width}px`;
  ui.frame.style.height = `${height}px`;
  ui.dimensions.textContent = `${width} × ${height}`;
}

async function checkForChanges() {
  try {
    const current = await requestJson("/api/version");
    if (current.version !== activeVersion) {
      await reloadBootstrap({ preserveSelection: true });
      setStatus("Local files changed; preview remounted", "success");
    }
  } catch (error) {
    setStatus(`Preview server unavailable: ${error.message}`, "error");
  }
}

async function loadDependencies(config) {
  if (dependenciesLoaded) return;
  for (const href of config.external_styles ?? []) {
    await loadStyle(href);
  }
  for (const src of config.external_scripts ?? []) {
    await loadScript(src);
  }
  dependenciesLoaded = true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  });
}

function loadStyle(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Could not load ${href}`));
    document.head.append(link);
  });
}

function currentElement() {
  return bootstrap.elements.find((element) => element.key === ui.element.value);
}

function currentScenario() {
  return bootstrap.scenarios[Number(ui.scenario.value)]?.scenario ?? null;
}

function fillSelect(select, options, preferred) {
  select.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  if (preferred && options.some((option) => option.value === preferred)) {
    select.value = preferred;
  }
}

function setStatus(message, tone) {
  ui.status.textContent = message;
  ui.status.dataset.tone = tone;
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function numericCss(value) {
  return typeof value === "number" ? `${value}px` : String(value);
}

async function requestJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}
