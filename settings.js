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

class State {
  constructor() {
    var themes = ["light", "dark"];
    themes.map(v => new ThemeSelector(v));

    var textSize = ["default", "bigger", "biggest"];
    textSize.map(v => new TextSizeSelector(v));
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
