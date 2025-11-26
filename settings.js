const FRONT_END_BASE = `http://${config.ouinet_client.host}:${config.ouinet_client.front_end.port}`;
const STATUS_ENDPOINT = FRONT_END_BASE + "/api/status";
const SET_VALUE_ENDPOINT = FRONT_END_BASE + "/";

class Button {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'checkbox') { return; }

    elem.addEventListener('click', event => this.onClick(event));

    this.id = id;
    this.elem = elem;
    this.cb = null;
  }

  set(value) {
    if (!this.elem) return;
    this.elem.disabled = false;
    this.elem.checked = value;
  }

  disable() {
    if (!this.elem) return;
    this.elem.checked = false;
    this.elem.disabled = true;
  }

  onClick(event) {
    if (!this.elem) return;
    const name = this.id;
    const newValue = this.elem.checked;
    if (this.cb) this.cb(newValue);
    fetch(SET_VALUE_ENDPOINT + `?${name}=${newValue ? 'enable' : 'disable'}`)
      .then(_ => this.set(newValue))
  }
}

class Text {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    this.elem = elem;
  }

  set(value) {
    if (!this.elem) return;

    if (!Array.isArray(value)) {
      this.elem.textContent = value;
      return;
    }

    // `ParentNode.replaceChildren` requires a recent browser,
    // so construct a new element with same tag and id,
    // then replace the one we have.
    var newElem = document.createElement(this.elem.tagName);
    newElem.id = this.elem.id;

    var first = true;
    for (var i in value) {
      if (!first) { newElem.appendChild(document.createElement("br")); }
      newElem.appendChild(document.createTextNode(value[i]));
      first = false;
    }

    this.elem.replaceWith(newElem);
    this.elem = newElem;
  }

  disable() {
    if (!this.elem) return;
    this.elem.textContent = "---";
  }
}

class DataSizeText extends Text {
  constructor(id) {
    super(id);
  }

  set(value) {
    var b = Number(value);
    if (isNaN(b) || b < 1024) {
      super.set(b + " B");
      return;
    }
    // See <https://stackoverflow.com/a/42408230>.
    var i = Math.floor(Math.log2(b) / 10);
    var v = b / Math.pow(1024, i);
    var u = "KMGTPEZY"[i-1] + "iB";
    super.set(`${v.toFixed(2)} ${u}`);
  }
}

class TextInput extends Text {
  constructor(id, separator=" ") {
    super(id);
    this.id = id;
    this.separator = separator;
    this.button = document.getElementById("save-" + id);
    this.savedHint = document.getElementById("saved-" + id);

    this.elem.form.addEventListener('submit', event => {
      this.doSave();
      event.preventDefault();
    });
    this.button.addEventListener('click', event => this.doSave());
  }

  set(value) {
    if (!this.elem) return;
    this.savedHint.style.display = "none";

    // Do not refresh a field which is being edited.
    if (document.activeElement === this.elem) return;

    this.elem.value = Array.isArray(value)
      ? value.join(this.separator)
      : value;

    this.elem.disabled = false;
    this.button.disabled = false;
  }

  disable() {
    if (!this.elem) return;
    this.elem.value = "";
    this.elem.disabled = true;
    this.button.disabled = true;
  }

  doSave() {
    if (!this.elem) return;
    const name = this.id;
    const newValue = this.elem.value.replace(/ /g, "+");
    fetch(SET_VALUE_ENDPOINT + `?${name}=${newValue}`)
      .then(_ => { this.savedHint.style.display = ""; })  // until next refresh
    ;
  }
}

class LogControl {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'checkbox') { return; }

    elem.addEventListener('click', event => this.onClick(event));

    this.id = id;
    this.elem = elem;
  }

  set(value) {
    if (!this.elem) return;
    this.elem.disabled = false;
    this.elem.checked = value;
  }

  disable() {
    if (!this.elem) return;
    this.elem.checked = false;
    this.elem.disabled = true;
  }

  onClick(event) {
    if (!this.elem) return;
    const name = this.id;
    const newValue = this.elem.checked;
    fetch(SET_VALUE_ENDPOINT + `?${name}=${newValue ? 'enable' : 'disable'}`)
      .then(_ => this.set(newValue))
  }
}

class ThemeSelector {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'button') { return; }

    elem.addEventListener('click', event => this.onClick(event));
    elem.addEventListener('mouseover', event => this.onMouseOver(event));
    elem.addEventListener('mouseout', event => this.onMouseOut(event));

    this.id = id;
    this.elem = elem;
    this.cb = null;
  }

  onMouseOver(event) {
    browser.storage.local.get("theme").then(item => {
      if ((this.elem.id != item.theme) && !this.elem.disabled) {
        this.elem.className = "setting hover"
      }
    });
  }

  onMouseOut(event) {
    browser.storage.local.get("theme").then(item => {
      if ((this.elem.id != item.theme) && !this.elem.disabled) {
        this.elem.className = "setting unselected"
        console.log(this.elem)
      }
    });
  }

  onClick(event) {
    if (!this.elem) return;
    setSelectedTheme(this.id)
    browser.storage.local.set({
      theme: this.id
    });
  }
}

class TextSizeSelector {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'button') { return; }

    elem.addEventListener('click', event => this.onClick(event));
    elem.addEventListener('mouseover', event => this.onMouseOver(event));
    elem.addEventListener('mouseout', event => this.onMouseOut(event));

    this.id = id;
    this.elem = elem;
    this.cb = null;
  }

  onMouseOver(event) {
    browser.storage.local.get("size").then(item => {
      if ((this.elem.id != item.size) && !this.elem.disabled) {
        this.elem.className = "setting hover"
      }
    });
  }

  onMouseOut(event) {
    browser.storage.local.get("size").then(item => {
      if ((this.elem.id != item.size) && !this.elem.disabled) {
        this.elem.className = "setting unselected"
        console.log(this.elem)
      }
    });
  }

  onClick(event) {
    if (!this.elem) return;
    setSelectedTextSize(this.id)
    browser.storage.local.set({
      size: this.id
    });
  }
}

class Action {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'button') { return; }

    elem.addEventListener('click', event => this.onClick(event));

    this.id = id;
    this.elem = elem;
  }

  enable() {
    if (!this.elem) return;
    this.elem.disabled = false;
  }

  disable() {
    if (!this.elem) return;
    this.elem.disabled = true;
  }

  onClick(event) {
    if (!this.elem) return;
    const name = this.id;
    fetch(SET_VALUE_ENDPOINT + `?${name}=do`);
    this.disable();
  }
}

function someEnabled(ids) {
  return ids.reduce((r, i) => (r || document.getElementById(i).checked), false);
}

function displayIfNoneEnabled(idTarget, idSources) {
  var target = document.getElementById(idTarget);
  if (!target) { return; }
  target.style.display = someEnabled(idSources) ? "none" : "block";
}

class State {
  constructor() {
    this.items = new Map();
    this.actions = new Array();

    var themes = ["light", "dark"];
    themes.map(v => new ThemeSelector(v));

    var textSize = ["default", "bigger", "biggest"];
    textSize.map(v => new TextSizeSelector(v));
  }

  set(key, value) {
    var item = this.items.get(key);
    if (!item) {
      return; // We might not have counterparts for all the things in State in DOM
    }
    item.set(value);
  }

  setCenoVersion() {
    this.ceno_version = new Text("ceno_version");
    browser.runtime.getBrowserInfo().then(info =>
      this.ceno_version.elem.textContent = `${info.version} Build ID ${info.buildID}`);
  }

  setCenoExtensionVersion() {
    this.ceno_extension_version = new Text("ceno_extension_version");
    this.ceno_extension_version.elem.textContent = browser.runtime.getManifest().version;
  }

  enable() {
    var warnings = document.getElementById("am-warnings");
    if (warnings) {
      warnings.style.display = "block";
      this.modeWarningChecks.forEach(check => check());
    }

    this.actions.forEach(a => a.enable());
  }

  disable() {
    var warnings = document.getElementById("am-warnings");
    if (warnings) { warnings.style.display = "none"; }

    this.items.forEach(v => v.disable());
    this.actions.forEach(a => a.disable());
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setFrontEndLinks() {
  for (const [id, path] of [ ["fe-link-cache-list", "/groups.txt"],
                             ["fe-link-log-file", "/logfile.txt"],
                           ]) {
    var elem = document.getElementById(id);
    if (!elem) continue;
    elem.href = FRONT_END_BASE + path;
  }
}

function setSelectedTheme(theme) {
    const lightBtn = document.getElementById('light');
    const darkBtn = document.getElementById('dark');
    if (theme === "dark") {
      lightBtn.className = "setting unselected"
      darkBtn.className = "setting selected"
    }
    else /* if (theme === "light") */ {
      lightBtn.className = "setting selected"
      darkBtn.className = "setting unselected"
    }
    setTheme(theme)
}

function setSelectedTextSize(size) {
  const defaultBtn = document.getElementById('default');
  const biggerBtn = document.getElementById('bigger');
  const biggestBtn = document.getElementById('biggest');
  if (size === "bigger") {
    defaultBtn.className = "setting unselected"
    biggerBtn.className = "setting selected"
    biggestBtn.className = "setting unselected"
  }
  else if (size === "biggest") {
    defaultBtn.className = "setting unselected"
    biggerBtn.className = "setting unselected"
    biggestBtn.className = "setting selected"
  }
  else /* if (size === "default") */ {
    defaultBtn.className = "setting selected"
    biggerBtn.className = "setting unselected"
    biggestBtn.className = "setting unselected"
  }
  setTextSize(size)
}

 window.addEventListener("load", async () => {
   browser.storage.local.get("theme").then(item => setSelectedTheme(item.theme));
   browser.storage.local.get("size").then(item => setSelectedTextSize(item.size));

   let state = new State();

});
