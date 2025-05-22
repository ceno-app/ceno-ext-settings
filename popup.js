'use strict';

function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function queryTabs(query) {
  return new Promise(resolve => { browser.tabs.query(query).then(resolve); });
}

function getCacheEntry(what) {
  return new Promise(resolve => { browser.storage.local.get(what, resolve); });
}

async function updatePage() {
  const active_tabs = await queryTabs({currentWindow:true, active:true});
  if (!active_tabs.length) return;
  const tabId = active_tabs[0].id;
  const data = await getCacheEntry('stats');
  if (!data || !data.stats || !data.stats[tabId]) return;

  const set = (name) => {
    var value = data.stats[tabId][name];
    if (!value) value = 0;
    document.getElementById(name).textContent = value;
  };

  set('origin');
  set('proxy');
  set('injector');
  set('dist-cache');
  set('local-cache');
}

function setSelectedMode(mode) {
  const publicBtn = document.getElementById('public');
  const personalBtn = document.getElementById('personal');
  const proxySrc = document.getElementById('proxyRow');
  const injectorSrc = document.getElementById('injectorRow');
  setBrowserAction(mode == "personal" || mode == "private")
  if (mode == "personal") {
    personalBtn.className = "mode selected-personal"
    publicBtn.className = "mode unselected"

    personalBtn.disabled = false
    publicBtn.disabled = false;

    proxySrc.style.visibility = "visible";
    injectorSrc.style.visibility = "collapse";
  }
  else if (mode == "private") {
    personalBtn.className = "mode selected-personal"
    publicBtn.className = "mode disabled"

    personalBtn.disabled = true;
    publicBtn.disabled = true;

    proxySrc.style.visibility = "visible";
    injectorSrc.style.visibility = "collapse";
  }
  else {
    personalBtn.className = "mode unselected"
    publicBtn.className = "mode selected-public"

    personalBtn.disabled = false;
    publicBtn.disabled = false;

    proxySrc.style.visibility = "collapse";
    injectorSrc.style.visibility = "visible";
  }
}

class ModeSelector {
  constructor(id) {
    var elem = document.getElementById(id);
    if (!elem) { return; }
    if (elem.type !== 'button') { return; }

    elem.addEventListener('click', event => this.onClick(event));
    elem.addEventListener('mouseover', event => this.onMouseOver(event));
    elem.addEventListener('mouseout', event => this.onMouseOut(event));

    this.id = id;
    this.elem = elem;
  }

  onMouseOver(event) {
    browser.storage.local.get("mode").then(item => {
      if ((this.elem.id != item.mode) && !this.elem.disabled) {
        this.elem.className = "mode hover"
      }
    });
  }

  onMouseOut(event) {
    browser.storage.local.get("mode").then(item => {
      if ((this.elem.id != item.mode) && !this.elem.disabled) {
        this.elem.className = "mode unselected"
        console.log(this.elem)
      }
    });
  }

  onClick(event) {
    setSelectedMode(this.id)
    if (!this.elem) return;
    browser.storage.local.set({
      mode: this.id
    });
  }
}

window.addEventListener("load", async () => {
  browser.storage.local.get("theme").then(item => setTheme(item.theme));
  browser.storage.local.get("size").then(item => setTextSize(item.size));
  new ModeSelector("public")
  new ModeSelector("personal")
  const active_tabs = await queryTabs({currentWindow:true, active:true});
  const tabId = active_tabs[0].id;
  browser.storage.local.get("mode").then(item => {
    if (item.mode != "public" && item.mode != "personal") {
      browser.storage.local.set({
        mode: "public"
      });
    }
    browser.tabs.get(tabId).then(tab => {
      if(tab.incognito){
        // Force mode when browsing in private tab
        setSelectedMode("private");
      }
      else {
        setSelectedMode(item.mode);
      }
    });
  });
});

(async function start() {
  while (true) {
    await updatePage();
    await sleep(0.5);
  }
})();
